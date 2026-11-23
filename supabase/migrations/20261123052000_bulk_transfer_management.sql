BEGIN;

CREATE FUNCTION public.bulk_transfer_batch_summary(p_batch_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id',b.id,'user_id',b.user_id,'title',b.title,'recipient_count',b.recipient_count,
    'principal',b.principal,'fee',b.fee,'vat',b.vat,'vat_percent',b.vat_percent,'total',b.principal+b.fee+b.vat,
    'created_at',b.created_at,'expires_at',b.expires_at,'authorized_at',b.authorized_at,'provider_batch_id',b.provider_batch_id,
    'completed',t.completed,'failed',t.failed,'pending',t.pending,'settled_principal',t.settled_principal,
    'settled_fee',t.settled_fee,'settled_vat',t.settled_vat,'refunded_total',t.refunded_total,
    'status', CASE
      WHEN b.authorized_at IS NULL THEN CASE WHEN b.expires_at>now() THEN 'quoted' ELSE 'expired' END
      WHEN t.completed=b.recipient_count THEN 'completed'
      WHEN t.failed=b.recipient_count THEN 'failed'
      WHEN t.pending=0 THEN 'partial'
      WHEN b.dispatch_started_at IS NULL THEN 'reserved'
      WHEN b.dispatch_started_at<now()-interval '15 minutes' OR
        (b.provider_batch_id IS NULL AND b.dispatch_started_at<now()-interval '2 minutes') THEN 'needs_review'
      ELSE 'processing' END)
  FROM public.bulk_transfer_batches b CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE status='completed') AS completed, count(*) FILTER (WHERE status='failed') AS failed,
      count(*) FILTER (WHERE status='pending') AS pending,
      coalesce(sum(amount) FILTER (WHERE status='completed'),0) AS settled_principal,
      coalesce(sum((metadata->>'fee')::numeric) FILTER (WHERE status='completed'),0) AS settled_fee,
      coalesce(sum((metadata->>'vat')::numeric) FILTER (WHERE status='completed'),0) AS settled_vat,
      coalesce(sum((metadata->>'total_debited')::numeric) FILTER (WHERE status='failed'),0) AS refunded_total
    FROM public.transactions WHERE bulk_batch_id=b.id
  ) t WHERE b.id=p_batch_id;
$$;

CREATE FUNCTION public.get_bulk_transfer_batch(p_batch_id uuid,p_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_batch public.bulk_transfer_batches%ROWTYPE;
  v_recipients jsonb;
BEGIN
  IF v_uid IS NULL OR (p_admin IS TRUE AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_uid AND role='admin' AND coalesce(status,'active')='active')) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_batch FROM public.bulk_transfer_batches WHERE id=p_batch_id
    AND (user_id=v_uid OR (p_admin IS TRUE AND authorized_at IS NOT NULL));
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg((r.item - 'account_number') || jsonb_build_object(
    'account_number', CASE WHEN p_admin IS NOT TRUE AND v_batch.user_id=v_uid THEN r.item->>'account_number' ELSE '••••••' || right(r.item->>'account_number',4) END,
    'status',coalesce(t.status,'quoted'),'message',coalesce(t.metadata->>'complete_message',
      CASE WHEN t.status='pending' THEN t.metadata->>'provider_batch_issue' END)) ORDER BY r.ordinality),'[]') INTO v_recipients
  FROM jsonb_array_elements(v_batch.recipients) WITH ORDINALITY AS r(item,ordinality)
  LEFT JOIN public.transactions t ON t.bulk_batch_id=v_batch.id AND t.reference_id=r.item->>'reference';
  RETURN public.bulk_transfer_batch_summary(v_batch.id) || jsonb_build_object('recipients',v_recipients);
END;
$$;

CREATE FUNCTION public.get_bulk_transfer_history(p_admin boolean DEFAULT false,p_before timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent jsonb;
BEGIN
  IF v_uid IS NULL OR (p_admin IS TRUE AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_uid AND role='admin' AND coalesce(status,'active')='active')) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(public.bulk_transfer_batch_summary(b.id) || jsonb_build_object('owner_name',p.name)
    ORDER BY b.authorized_at DESC,b.id DESC),'[]') INTO v_recent
  FROM (SELECT id,user_id,authorized_at FROM public.bulk_transfer_batches WHERE authorized_at IS NOT NULL
    AND (p_admin IS TRUE OR user_id=v_uid) AND (p_before IS NULL OR authorized_at<p_before)
    ORDER BY authorized_at DESC,id DESC LIMIT 25) b JOIN public.profiles p ON p.id=b.user_id;
  RETURN v_recent;
END;
$$;

CREATE FUNCTION public.admin_update_bulk_transfer_settings(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_saved public.bulk_transfer_settings%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_admin AND role='admin' AND coalesce(status,'active')='active') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';
  END IF;
  UPDATE public.bulk_transfer_settings SET enabled=(p_settings->>'enabled')::boolean,
    max_recipients=(p_settings->>'max_recipients')::integer, max_batch_amount=(p_settings->>'max_batch_amount')::numeric,
    daily_amount_limit=(p_settings->>'daily_amount_limit')::numeric, small_fee=(p_settings->>'small_fee')::numeric,
    medium_fee=(p_settings->>'medium_fee')::numeric, large_fee=(p_settings->>'large_fee')::numeric,
    vat_percent=(p_settings->>'vat_percent')::numeric, revision=gen_random_uuid()
  WHERE singleton RETURNING * INTO STRICT v_saved;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,summary,metadata)
    VALUES(v_admin,'bulk_transfer_settings_updated','system','Updated bulk transfer fees and limits',to_jsonb(v_saved)-ARRAY['revision','singleton']);
  RETURN to_jsonb(v_saved)-ARRAY['revision','singleton'];
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_transfer_batch_summary(uuid),public.get_bulk_transfer_batch(uuid,boolean),
  public.get_bulk_transfer_history(boolean,timestamptz),public.admin_update_bulk_transfer_settings(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_bulk_transfer_batch(uuid,boolean),public.get_bulk_transfer_history(boolean,timestamptz),
  public.admin_update_bulk_transfer_settings(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
