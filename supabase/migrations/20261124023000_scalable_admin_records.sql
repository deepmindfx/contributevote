BEGIN;

CREATE INDEX IF NOT EXISTS admin_profiles_page_idx ON public.profiles ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_groups_page_idx ON public.contribution_groups ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_ledger_page_idx ON public.transactions ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_account_ledger_page_idx ON public.transactions
  (user_id,(coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_aml_page_idx ON public.aml_alerts ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_notices_page_idx ON public.admin_penalties ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_outside_payments_page_idx ON public.external_payment_tracks ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_audit_page_idx ON public.admin_audit_logs ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_wallet_page_idx ON public.wallet_adjustment_requests ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_payouts_page_idx ON public.payout_recovery_reviews ((coalesce(created_at,'-infinity'::timestamptz)),id);
CREATE INDEX IF NOT EXISTS admin_incoming_page_idx ON public.inbound_payment_review
  ((coalesce(created_at,'-infinity'::timestamptz)),provider_id) WHERE resolved_at IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS admin_profile_directory_search_idx ON public.profiles USING gin
  ((coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_group_directory_search_idx ON public.contribution_groups USING gin
  ((name || ' ' || category) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_reference_search_idx ON public.transactions USING gin (reference_id extensions.gin_trgm_ops);

-- Pagination is restricted to active administrators, even for lists containing public groups.
-- A stable timestamp and ID let the next page seek directly to older (or queued) records.
CREATE FUNCTION public.admin_page_records(
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
      AND (p_status='all' OR t.type=p_status) AND (p_filter<>'high' OR t.amount>=500000)
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

REVOKE ALL ON FUNCTION public.admin_page_records(text,text,text,text,timestamptz,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_page_records(text,text,text,text,timestamptz,text,integer,uuid) TO authenticated;

-- Bound the same directory search used by account pickers and transaction analytics.
CREATE OR REPLACE FUNCTION public.admin_search_transaction_entities(p_scope text,p_search text)
RETURNS TABLE(id uuid,name text,description text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_search text := btrim(coalesce(p_search,''));
  v_pattern text;
  v_id uuid;
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN
    RAISE EXCEPTION 'Active administrator access required' USING ERRCODE='42501';
  END IF;
  IF length(v_search)>120 THEN RETURN; END IF;
  IF v_search ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN v_id := v_search::uuid; END IF;
  v_pattern := '%' || replace(replace(replace(v_search,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_') || '%';
  IF p_scope='account' THEN
    RETURN QUERY SELECT p.id,coalesce(nullif(p.name,''),p.email,'Unnamed account'),
      coalesce(nullif(concat_ws(' · ',p.email,p.phone),''),p.id::text)
    FROM public.profiles p
    WHERE v_search='' OR (coalesce(p.name,'') || ' ' || coalesce(p.email,'') || ' ' || coalesce(p.phone,'')) ILIKE v_pattern OR p.id=v_id
    ORDER BY coalesce(p.created_at,'-infinity'::timestamptz) DESC,p.id DESC LIMIT 25;
  ELSIF p_scope='group' THEN
    RETURN QUERY SELECT g.id,g.name,g.category FROM public.contribution_groups g
    WHERE v_search='' OR (g.name || ' ' || g.category) ILIKE v_pattern OR g.id=v_id
    ORDER BY coalesce(g.created_at,'-infinity'::timestamptz) DESC,g.id DESC LIMIT 25;
  ELSE
    RAISE EXCEPTION 'Invalid directory scope' USING ERRCODE='22023';
  END IF;
END;
$$;

-- A compliance notice records the facts and informs the customer without creating a debt or ledger entry.
ALTER TABLE public.admin_penalties DROP CONSTRAINT admin_penalties_amount_check;
ALTER TABLE public.admin_penalties ADD CONSTRAINT admin_penalties_amount_check CHECK (amount>=0);
REVOKE INSERT,UPDATE,DELETE ON public.admin_penalties FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_issue_penalty(
  p_user_id uuid,p_amount numeric,p_penalty_type text,p_reason text,
  p_deduct_wallet boolean DEFAULT false,p_group_id uuid DEFAULT NULL,p_aml_alert_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_id uuid;
  v_group uuid := p_group_id;
  v_alert public.aml_alerts%ROWTYPE;
  v_amount numeric := coalesce(p_amount,0);
  v_reason text := btrim(coalesce(p_reason,''));
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN
    RAISE EXCEPTION 'Active administrator access required' USING ERRCODE='42501';
  END IF;
  IF p_deduct_wallet IS DISTINCT FROM false THEN
    RETURN json_build_object('success',false,'error','Compliance notices cannot change a wallet balance.');
  END IF;
  IF v_amount NOT BETWEEN 0 AND 9999999999999.99 OR v_amount<>round(v_amount,2)
    OR length(v_reason) NOT BETWEEN 1 AND 1000
    OR coalesce(p_penalty_type,'') NOT IN ('late_contribution','policy_violation','aml_hold','fraud_chargeback','dispute_fine') THEN
    RETURN json_build_object('success',false,'error','Enter a valid category, reason, and optional reference amount.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN
    RETURN json_build_object('success',false,'error','User not found.');
  END IF;
  IF p_aml_alert_id IS NOT NULL THEN
    SELECT * INTO v_alert FROM public.aml_alerts WHERE id=p_aml_alert_id;
    IF NOT FOUND OR v_alert.user_id IS DISTINCT FROM p_user_id
      OR (v_alert.group_id IS NOT NULL AND v_group IS NOT NULL AND v_alert.group_id<>v_group) THEN
      RETURN json_build_object('success',false,'error','The alert does not match the selected account or group.');
    END IF;
    v_group := coalesce(v_alert.group_id,v_group);
  END IF;
  INSERT INTO public.admin_penalties(user_id,group_id,aml_alert_id,penalty_type,amount,reason,status,issued_by)
  VALUES(p_user_id,v_group,p_aml_alert_id,p_penalty_type,v_amount,v_reason,'pending',auth.uid()) RETURNING id INTO v_id;

  INSERT INTO public.notifications(user_id,type,title,message,related_id,is_read)
  VALUES(p_user_id,'penalty','Account notice',v_reason || ' This notice does not require a payment or change your wallet balance.',v_group,false);
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
  VALUES(auth.uid(),'record_compliance_notice','penalty',v_id::text,'Recorded a compliance notice.',
    jsonb_build_object('user_id',p_user_id,'reference_amount',v_amount,'category',p_penalty_type,'reason',v_reason));
  RETURN json_build_object('success',true,'penalty_id',v_id,'status','pending','deducted_from_wallet',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_waive_penalty(p_penalty_id uuid,p_refund_wallet boolean DEFAULT false,p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_record public.admin_penalties%ROWTYPE;
  v_note text := coalesce(nullif(btrim(p_note),''),'Closed by administrator');
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN
    RAISE EXCEPTION 'Active administrator access required' USING ERRCODE='42501';
  END IF;
  IF p_refund_wallet IS DISTINCT FROM false THEN
    RETURN json_build_object('success',false,'error','Closing a compliance record cannot change a wallet balance.');
  END IF;
  UPDATE public.admin_penalties SET status='waived',waived_by=auth.uid(),waived_at=now(),waive_note=v_note
  WHERE id=p_penalty_id AND status<>'waived' RETURNING * INTO v_record;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','The compliance record is already closed or unavailable.');
  END IF;
  INSERT INTO public.notifications(user_id,type,title,message,related_id,is_read)
  VALUES(v_record.user_id,'penalty','Account notice closed',
    'CollectiPay closed this compliance record. Your wallet balance did not change.',v_record.group_id,false);
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
  VALUES(auth.uid(),'close_compliance_notice','penalty',p_penalty_id::text,'Closed a compliance record.',
    jsonb_build_object('user_id',v_record.user_id,'note',v_note,'historical_debit',v_record.deducted_from_wallet));
  RETURN json_build_object('success',true,'refunded',false);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
