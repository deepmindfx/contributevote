BEGIN;

CREATE INDEX bulk_transfer_batches_owner_history_idx ON public.bulk_transfer_batches(user_id, authorized_at DESC, id DESC)
WHERE authorized_at IS NOT NULL;

CREATE FUNCTION public.get_my_bulk_transfer_history(
  p_month date, p_status text DEFAULT NULL, p_before timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz := p_month::timestamp AT TIME ZONE 'Africa/Lagos';
  v_end timestamptz := (p_month + interval '1 month') AT TIME ZONE 'Africa/Lagos';
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your bulk transfers' USING ERRCODE='42501';
  END IF;
  IF p_month IS NULL OR NOT isfinite(p_month) OR extract(day FROM p_month) <> 1
    OR (p_before IS NULL) <> (p_before_id IS NULL)
    OR (p_status IS NOT NULL AND p_status NOT IN ('pending','completed','partial','failed','needs_review')) THEN
    RAISE EXCEPTION 'Invalid bulk transfer history filter' USING ERRCODE='22023';
  END IF;

  SELECT coalesce(jsonb_agg(rows.summary ORDER BY rows.authorized_at DESC,rows.id DESC),'[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT b.id,b.authorized_at,summary.row AS summary
    FROM public.bulk_transfer_batches b
    CROSS JOIN LATERAL (SELECT public.bulk_transfer_batch_summary(b.id) AS row) summary
    WHERE b.user_id=v_uid AND b.authorized_at>=v_start AND b.authorized_at<v_end
      AND (p_before IS NULL OR (b.authorized_at,b.id)<(p_before,p_before_id))
      AND (p_status IS NULL OR (p_status='pending' AND (summary.row->>'pending')::integer>0)
        OR summary.row->>'status'=p_status)
    ORDER BY b.authorized_at DESC,b.id DESC
    LIMIT 25
  ) rows;
  RETURN v_rows;
END;
$$;

CREATE FUNCTION public.get_my_bulk_transfer_analytics(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz := p_month::timestamp AT TIME ZONE 'Africa/Lagos';
  v_end timestamptz := (p_month + interval '1 month') AT TIME ZONE 'Africa/Lagos';
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to view bulk transfer analytics' USING ERRCODE='42501';
  END IF;
  IF p_month IS NULL OR NOT isfinite(p_month) OR extract(day FROM p_month)<>1 THEN
    RAISE EXCEPTION 'Choose a statement month' USING ERRCODE='22023';
  END IF;

  WITH batches AS MATERIALIZED (
    SELECT b.id,b.authorized_at,b.principal+b.fee+b.vat AS debit
    FROM public.bulk_transfer_batches b
    WHERE b.user_id=v_uid AND b.authorized_at>=v_start AND b.authorized_at<v_end
  ), payouts AS MATERIALIZED (
    SELECT (b.authorized_at AT TIME ZONE 'Africa/Lagos')::date AS authorized_day,t.status,t.amount,
      t.metadata->>'account_bank' AS bank_code,nullif(btrim(t.metadata->>'bank_name'),'') AS bank_name,
      coalesce((t.metadata->>'fee')::numeric,0) AS fee,coalesce((t.metadata->>'vat')::numeric,0) AS vat,
      coalesce((t.metadata->>'total_debited')::numeric,t.amount) AS debit
    FROM batches b JOIN public.transactions t ON t.bulk_batch_id=b.id AND t.user_id=v_uid
  ), totals AS (
    SELECT count(*) AS recipients,count(*) FILTER (WHERE status='completed') AS completed,
      count(*) FILTER (WHERE status='pending') AS pending,count(*) FILTER (WHERE status='failed') AS failed,
      coalesce(sum(amount) FILTER (WHERE status='completed'),0) AS paid_principal,
      coalesce(sum(fee) FILTER (WHERE status='completed'),0) AS paid_fee,
      coalesce(sum(vat) FILTER (WHERE status='completed'),0) AS paid_vat,
      coalesce(sum(debit) FILTER (WHERE status='pending'),0) AS pending_total,
      coalesce(sum(debit) FILTER (WHERE status='failed'),0) AS refunded_total
    FROM payouts
  ), by_day AS (
    SELECT authorized_day,coalesce(sum(amount) FILTER (WHERE status='completed'),0) AS paid,
      coalesce(sum(amount) FILTER (WHERE status='pending'),0) AS pending,
      coalesce(sum(amount) FILTER (WHERE status='failed'),0) AS failed
    FROM payouts GROUP BY authorized_day
  ), by_bank AS (
    SELECT bank_code,max(bank_name) AS bank_name,count(*) AS recipients,
      count(*) FILTER (WHERE status='completed') AS completed,count(*) FILTER (WHERE status='pending') AS pending,
      count(*) FILTER (WHERE status='failed') AS failed,
      coalesce(sum(amount) FILTER (WHERE status='completed'),0) AS paid_principal
    FROM payouts GROUP BY bank_code
  )
  SELECT jsonb_build_object(
    'totals',to_jsonb(totals) || jsonb_build_object(
      'batches',(SELECT count(*) FROM batches),
      'authorized_total',(SELECT coalesce(sum(debit),0) FROM batches),
      'previous_paid_principal',(SELECT coalesce(sum(t.amount),0) FROM public.bulk_transfer_batches b
        JOIN public.transactions t ON t.bulk_batch_id=b.id AND t.user_id=v_uid AND t.status='completed'
        WHERE b.user_id=v_uid AND b.authorized_at>=(p_month - interval '1 month') AT TIME ZONE 'Africa/Lagos'
          AND b.authorized_at<v_start)
    ),
    'daily',(SELECT jsonb_agg(jsonb_build_object('day',days.day+1,'paid',coalesce(d.paid,0),
      'pending',coalesce(d.pending,0),'failed',coalesce(d.failed,0)) ORDER BY days.day)
      FROM generate_series(0,(p_month + interval '1 month')::date-p_month-1) AS days(day)
      LEFT JOIN by_day d ON d.authorized_day=p_month+days.day),
    'banks',(SELECT coalesce(jsonb_agg(to_jsonb(by_bank) ORDER BY paid_principal DESC,recipients DESC,bank_code),'[]'::jsonb)
      FROM by_bank)
  ) INTO v_result FROM totals;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_bulk_transfer_history(date,text,timestamptz,uuid),
  public.get_my_bulk_transfer_analytics(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_bulk_transfer_history(date,text,timestamptz,uuid),
  public.get_my_bulk_transfer_analytics(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
