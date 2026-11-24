BEGIN;

CREATE FUNCTION public.guard_browser_account_status()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Account status changes must use the audited administrator action' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_browser_account_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_browser_account_status BEFORE UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_browser_account_status();

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,p_status text,p_reason text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_name text;
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success',false,'error','Active administrator access required');
  END IF;
  IF coalesce(p_status,'') NOT IN ('active','paused','frozen','suspended') THEN
    RETURN json_build_object('success',false,'error','Invalid account status');
  END IF;
  IF p_user_id=v_admin AND p_status<>'active' THEN
    RETURN json_build_object('success',false,'error','You cannot restrict your own administrator account.');
  END IF;

  -- Serialize changes involving either account, including two staff members restricting each other.
  PERFORM 1 FROM public.profiles WHERE id IN (v_admin,p_user_id) ORDER BY id FOR NO KEY UPDATE;
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success',false,'error','Active administrator access required');
  END IF;
  SELECT coalesce(name,email),coalesce(status,'active') INTO v_name,v_status
  FROM public.profiles WHERE id=p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','Account not found');
  END IF;
  IF v_status=p_status THEN
    RETURN json_build_object('success',true,'status',p_status);
  END IF;

  UPDATE public.profiles SET status=p_status,updated_at=now() WHERE id=p_user_id;
  INSERT INTO public.notifications(user_id,type,title,message,is_read)
  VALUES(p_user_id,'security_alert',
    CASE WHEN p_status='active' THEN 'Account Reactivated'
      WHEN p_status='frozen' THEN 'Account Frozen for Review' ELSE 'Account Status Updated' END,
    CASE WHEN p_status='active' THEN 'Your CollectiPay account is now active and all wallet features are restored.'
      ELSE format('Your account status has been set to %s.%s',p_status,
        CASE WHEN nullif(btrim(p_reason),'') IS NOT NULL THEN ' Reason: ' || btrim(p_reason) ELSE '' END) END,false);
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
  VALUES(v_admin,'user_status_'||p_status,'user',p_user_id::text,
    format('Set %s status from %s to %s',v_name,v_status,p_status),
    jsonb_build_object('previous_status',v_status,'new_status',p_status,'reason',p_reason));
  RETURN json_build_object('success',true,'status',p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_user_status(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid,text,text) TO authenticated;

-- Financial threshold searches exclude recorded votes even when the proposal amount is high.
CREATE OR REPLACE FUNCTION public.admin_page_records(
  p_view text,p_status text DEFAULT 'all',p_filter text DEFAULT 'all',p_search text DEFAULT '',
  p_before_at timestamptz DEFAULT NULL,p_before_id text DEFAULT NULL,p_limit integer DEFAULT 26,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id text,cursor_at timestamptz,record jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_search text := btrim(coalesce(p_search,''));
  v_pattern text;
  v_cursor uuid;
  v_id uuid;
  v_limit integer := least(51,greatest(1,coalesce(p_limit,26)));
  v_uuid_pattern constant text := '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$';
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN
    RAISE EXCEPTION 'Active administrator access required' USING ERRCODE='42501';
  END IF;
  IF length(v_search)>(CASE WHEN p_view IN ('ledger','user_ledger') THEN 180 ELSE 120 END)
    OR (p_before_at IS NULL)<>(p_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid record search or page cursor' USING ERRCODE='22023';
  END IF;
  IF (p_view='user_ledger') IS DISTINCT FROM (p_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Account history requires exactly one account' USING ERRCODE='22023';
  END IF;
  IF p_before_id IS NOT NULL AND p_view<>'inbound' THEN v_cursor := p_before_id::uuid; END IF;
  IF v_search ~* v_uuid_pattern THEN v_id := v_search::uuid; END IF;
  v_pattern := '%' || replace(replace(replace(v_search,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_') || '%';

  IF p_view='users' THEN
    RETURN QUERY
    SELECT p.id::text, coalesce(p.created_at,'-infinity'::timestamptz), jsonb_build_object(
      'id',p.id,'name',p.name,'email',p.email,'phone',p.phone,'status',p.status,'role',p.role,
      'wallet_balance',p.wallet_balance,'has_bvn',coalesce(p.bvn ~ '^[0-9]{11}$',false),
      'has_pin',EXISTS(SELECT 1 FROM public.wallet_pin_credentials c WHERE c.user_id=p.id),
      'profile_image',p.preferences->>'profileImage','is_verified_organizer',p.is_verified_organizer,
      'organizer_badge_label',p.organizer_badge_label)
    FROM public.profiles p
    WHERE (p_before_at IS NULL OR (coalesce(p.created_at,'-infinity'::timestamptz),p.id) < (p_before_at,v_cursor))

      AND (v_search='' OR (coalesce(p.name,'') || ' ' || coalesce(p.email,'') || ' ' || coalesce(p.phone,'')) ILIKE v_pattern OR p.id=v_id)
      AND (p_status='all' OR (p_status='active' AND coalesce(p.status,'active')='active')
        OR (p_status='paused' AND p.status='paused') OR (p_status='frozen' AND p.status IN ('frozen','suspended'))
        OR (p_status='no_bvn' AND NOT coalesce(p.bvn ~ '^[0-9]{11}$',false)))
    ORDER BY coalesce(p.created_at,'-infinity'::timestamptz) DESC,p.id DESC
    LIMIT v_limit;
  ELSIF p_view='groups' THEN
    RETURN QUERY
    SELECT g.id::text, coalesce(g.created_at,'-infinity'::timestamptz), jsonb_build_object(
      'id',g.id,'name',g.name,'category',g.category,'frequency',g.frequency,'status',g.status,
      'archived',g.archived,'is_verified',g.is_verified,'is_pinned',g.is_pinned,'spotlight_label',g.spotlight_label,
      'featured_priority',g.featured_priority,'verification_note',g.verification_note,'current_amount',g.current_amount,
      'target_amount',g.target_amount,'voting_threshold',g.voting_threshold,'enable_voting_rights',g.enable_voting_rights,
      'privacy',g.privacy,'profiles',jsonb_build_object('name',p.name,'email',p.email),
      'member_count',(SELECT count(*) FROM public.contributors c WHERE c.group_id=g.id))
    FROM public.contribution_groups g
    LEFT JOIN public.profiles p ON p.id=g.creator_id
    WHERE (p_before_at IS NULL OR (coalesce(g.created_at,'-infinity'::timestamptz),g.id) < (p_before_at,v_cursor))

      AND (v_search='' OR (g.name || ' ' || g.category) ILIKE v_pattern OR p.name ILIKE v_pattern OR g.id=v_id)
      AND (p_status='all' OR (p_status='active' AND NOT coalesce(g.archived,false) AND coalesce(g.status,'active')='active')
        OR (p_status='verified' AND g.is_verified) OR (p_status='pinned' AND (g.is_pinned OR nullif(g.spotlight_label,'') IS NOT NULL))
        OR (p_status='restricted' AND g.status IN ('paused','frozen')) OR (p_status='archived' AND g.archived))
    ORDER BY coalesce(g.created_at,'-infinity'::timestamptz) DESC,g.id DESC
    LIMIT v_limit;
  ELSIF p_view IN ('ledger','user_ledger') THEN
    RETURN QUERY
    SELECT t.id::text, coalesce(t.created_at,'-infinity'::timestamptz), to_jsonb(t) || jsonb_build_object(
      'profiles',jsonb_build_object('name',p.name,'email',p.email),'contribution_groups',jsonb_build_object('name',g.name))
    FROM public.transactions t
    LEFT JOIN public.profiles p ON p.id=t.user_id
    LEFT JOIN public.contribution_groups g ON g.id=t.contribution_id
    WHERE (p_before_at IS NULL OR (coalesce(t.created_at,'-infinity'::timestamptz),t.id) < (p_before_at,v_cursor))
      AND (p_user_id IS NULL OR t.user_id=p_user_id)
      AND (p_status='all' OR t.type=p_status) AND (p_filter<>'high' OR (t.type<>'vote' AND t.amount>=500000))
      AND (v_search='' OR t.id=v_id OR t.reference_id ILIKE v_pattern OR t.description ILIKE v_pattern
        OR p.name ILIKE v_pattern OR p.email ILIKE v_pattern OR g.name ILIKE v_pattern)
    ORDER BY coalesce(t.created_at,'-infinity'::timestamptz) DESC,t.id DESC
    LIMIT v_limit;
  ELSIF p_view='aml' THEN
    RETURN QUERY
    SELECT a.id::text, coalesce(a.created_at,'-infinity'::timestamptz), to_jsonb(a) || jsonb_build_object(
      'user_profile',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'name',p.name,'email',p.email,'status',p.status,'has_bvn',coalesce(p.bvn ~ '^[0-9]{11}$',false)) END,
      'group',CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object('name',g.name,'status',g.status) END)
    FROM public.aml_alerts a
    LEFT JOIN public.profiles p ON p.id=a.user_id
    LEFT JOIN public.contribution_groups g ON g.id=a.group_id
    WHERE (p_before_at IS NULL OR (coalesce(a.created_at,'-infinity'::timestamptz),a.id) < (p_before_at,v_cursor))

      AND (p_status='all' OR a.status=p_status OR (p_status='active' AND a.status IN ('open','investigating','escalated')))
      AND (p_filter='all' OR a.severity=p_filter)
    ORDER BY coalesce(a.created_at,'-infinity'::timestamptz) DESC,a.id DESC
    LIMIT v_limit;
  ELSIF p_view='penalties' THEN
    RETURN QUERY
    SELECT n.id::text, coalesce(n.created_at,'-infinity'::timestamptz), to_jsonb(n) || jsonb_build_object(
      'user_profile',jsonb_build_object('name',p.name,'email',p.email),'group',jsonb_build_object('name',g.name))
    FROM public.admin_penalties n
    JOIN public.profiles p ON p.id=n.user_id
    LEFT JOIN public.contribution_groups g ON g.id=n.group_id
    WHERE (p_before_at IS NULL OR (coalesce(n.created_at,'-infinity'::timestamptz),n.id) < (p_before_at,v_cursor))

      AND (p_status='all' OR n.status=p_status)
      AND (v_search='' OR (coalesce(p.name,'') || ' ' || coalesce(p.email,'') || ' ' || coalesce(p.phone,'')) ILIKE v_pattern OR n.reason ILIKE v_pattern OR n.id=v_id)
    ORDER BY coalesce(n.created_at,'-infinity'::timestamptz) DESC,n.id DESC
    LIMIT v_limit;
  ELSIF p_view='external' THEN
    RETURN QUERY
    SELECT e.id::text, coalesce(e.created_at,'-infinity'::timestamptz), to_jsonb(e) || jsonb_build_object(
      'user_profile',jsonb_build_object('name',p.name,'email',p.email),'group',jsonb_build_object('name',g.name))
    FROM public.external_payment_tracks e
    LEFT JOIN public.profiles p ON p.id=e.user_id
    LEFT JOIN public.contribution_groups g ON g.id=e.group_id
    WHERE (p_before_at IS NULL OR (coalesce(e.created_at,'-infinity'::timestamptz),e.id) < (p_before_at,v_cursor))

      AND (p_status='all' OR e.verification_status=p_status)
      AND (v_search='' OR e.sender_name ILIKE v_pattern OR e.sender_bank ILIKE v_pattern
        OR e.reference_id ILIKE v_pattern OR g.name ILIKE v_pattern OR e.narration ILIKE v_pattern)
    ORDER BY coalesce(e.created_at,'-infinity'::timestamptz) DESC,e.id DESC
    LIMIT v_limit;
  ELSIF p_view='audit' THEN
    RETURN QUERY
    SELECT a.id::text, coalesce(a.created_at,'-infinity'::timestamptz), (to_jsonb(a)-'metadata') || jsonb_build_object('admin_profile',jsonb_build_object('name',p.name,'email',p.email))
    FROM public.admin_audit_logs a
    LEFT JOIN public.profiles p ON p.id=a.admin_id
    WHERE (p_before_at IS NULL OR (coalesce(a.created_at,'-infinity'::timestamptz),a.id) < (p_before_at,v_cursor))

      AND (v_search='' OR a.summary ILIKE v_pattern OR a.action ILIKE v_pattern OR a.target_type ILIKE v_pattern
        OR p.name ILIKE v_pattern OR a.target_id=v_search)
    ORDER BY coalesce(a.created_at,'-infinity'::timestamptz) DESC,a.id DESC
    LIMIT v_limit;
  ELSIF p_view='wallet_pending' THEN
    RETURN QUERY
    SELECT r.id::text, coalesce(r.created_at,'-infinity'::timestamptz), jsonb_build_object(
      'id',r.id,'target_user_id',r.target_user_id,'target_name',coalesce(nullif(p.name,''),p.email,r.target_user_id::text),
      'submitted_by',r.submitted_by,'case_reference',r.case_reference,'direction',r.direction,
      'amount',r.amount,'reason',r.reason,'status',r.status)
    FROM public.wallet_adjustment_requests r
    JOIN public.profiles p ON p.id=r.target_user_id
    WHERE (p_before_at IS NULL OR (coalesce(r.created_at,'-infinity'::timestamptz),r.id) > (p_before_at,v_cursor))

      AND r.status='pending'
    ORDER BY coalesce(r.created_at,'-infinity'::timestamptz) ASC,r.id ASC
    LIMIT v_limit;
  ELSIF p_view='wallet_history' THEN
    RETURN QUERY
    SELECT r.id::text, coalesce(r.created_at,'-infinity'::timestamptz), jsonb_build_object(
      'id',r.id,'target_user_id',r.target_user_id,'target_name',coalesce(nullif(p.name,''),p.email,r.target_user_id::text),
      'submitted_by',r.submitted_by,'case_reference',r.case_reference,'direction',r.direction,
      'amount',r.amount,'reason',r.reason,'status',r.status)
    FROM public.wallet_adjustment_requests r
    JOIN public.profiles p ON p.id=r.target_user_id
    WHERE (p_before_at IS NULL OR (coalesce(r.created_at,'-infinity'::timestamptz),r.id) < (p_before_at,v_cursor))

      AND r.status<>'pending'
    ORDER BY coalesce(r.created_at,'-infinity'::timestamptz) DESC,r.id DESC
    LIMIT v_limit;
  ELSIF p_view='payouts' THEN
    RETURN QUERY
    SELECT r.id::text, coalesce(r.created_at,'-infinity'::timestamptz), jsonb_build_object(
      'id',r.id,'reference_id',t.reference_id,'amount',t.amount,'transfer_status',t.status,'bulk',t.bulk_batch_id IS NOT NULL,
      'basis',r.basis,'evidence_reference',r.evidence_reference,'evidence_note',r.evidence_note,
      'status',r.status,'submitted_by',r.submitted_by)
    FROM public.payout_recovery_reviews r
    JOIN public.transactions t ON t.id=r.transaction_id
    WHERE (p_before_at IS NULL OR (coalesce(r.created_at,'-infinity'::timestamptz),r.id) < (p_before_at,v_cursor))

      AND (p_status='all' OR (p_status='pending' AND r.status='pending')
        OR (p_status='history' AND r.status<>'pending'))
    ORDER BY coalesce(r.created_at,'-infinity'::timestamptz) DESC,r.id DESC
    LIMIT v_limit;
  ELSIF p_view='inbound' THEN
    RETURN QUERY
    SELECT r.provider_id::text, coalesce(r.created_at,'-infinity'::timestamptz), jsonb_build_object('provider_id',r.provider_id,'amount',r.amount,'reason',r.reason)
    FROM public.inbound_payment_review r
    WHERE (p_before_at IS NULL OR (coalesce(r.created_at,'-infinity'::timestamptz),r.provider_id) > (p_before_at,p_before_id))

      AND r.resolved_at IS NULL
    ORDER BY coalesce(r.created_at,'-infinity'::timestamptz) ASC,r.provider_id ASC
    LIMIT v_limit;
  ELSE
    RAISE EXCEPTION 'Unknown administrator view' USING ERRCODE='22023';
  END IF;
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
