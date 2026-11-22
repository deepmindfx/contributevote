BEGIN;

CREATE TABLE public.fixed_savings_settings_audit (
  revision integer PRIMARY KEY,
  changed_by uuid,
  source text NOT NULL DEFAULT 'super_admin' CHECK (source IN ('super_admin','deployment')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  previous jsonb NOT NULL,
  updated jsonb NOT NULL,
  CHECK ((changed_by IS NOT NULL) = (source='super_admin'))
);
ALTER TABLE public.fixed_savings_settings_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fixed_savings_settings_audit FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.fixed_savings_admin_settings(p_program public.fixed_savings_program)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('revision',p_program.revision,'enabled',p_program.enabled,
    'ready',public.fixed_savings_program_ready(p_program),'settlement_mode',p_program.settlement_mode,
    'scheduler_seen_at',p_program.scheduler_seen_at,'terms_version',p_program.terms_version,
    'terms_url',(SELECT document_url FROM public.fixed_savings_terms WHERE version=p_program.terms_version),
    'min_amount',p_program.min_amount,'max_amount',p_program.max_amount,
    'max_wallet_locked',p_program.max_wallet_locked,'max_active_locks',p_program.max_active_locks,
    'allowed_days',p_program.allowed_days)
$$;

CREATE FUNCTION public.admin_get_fixed_savings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_program public.fixed_savings_program%ROWTYPE;
  v_summary jsonb;
  v_updated_at timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND status='active') THEN
    RAISE EXCEPTION 'Active Super Admin access required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton;
  SELECT changed_at INTO v_updated_at FROM public.fixed_savings_settings_audit WHERE revision=v_program.revision;
  SELECT jsonb_build_object(
    'locked',coalesce(sum(amount) FILTER (WHERE status='active'),0),
    'active_count',count(*) FILTER (WHERE status='active'),
    'pending',coalesce(sum(amount) FILTER (WHERE status='reserving'),0),
    'matured_uncredited',coalesce(sum(amount) FILTER (WHERE status='matured' AND credited_at IS NULL),0),
    'released_30d',coalesce(sum(amount) FILTER (WHERE credited_at>=now()-interval '30 days'),0),
    'due_next_7d',coalesce(sum(amount) FILTER (WHERE status='active' AND maturity_at>now() AND maturity_at<=now()+interval '7 days'),0),
    'overdue_count',count(*) FILTER (WHERE status='active' AND maturity_at<now()-interval '5 minutes'),
    'overdue_amount',coalesce(sum(amount) FILTER (WHERE status='active' AND maturity_at<now()-interval '5 minutes'),0),
    'old_pending_count',count(*) FILTER (WHERE status='reserving' AND requested_at<now()-interval '15 minutes')
  ) INTO v_summary FROM public.fixed_savings;
  RETURN jsonb_build_object('settings',public.fixed_savings_admin_settings(v_program),
    'totals',v_summary,'updated_at',v_updated_at);
END;
$$;

CREATE FUNCTION public.admin_save_fixed_savings(p_revision integer,p_enabled boolean,p_min_amount numeric,
  p_max_amount numeric,p_max_wallet_locked numeric,p_max_active_locks integer,p_allowed_days integer[],
  p_terms_version text,p_terms_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_old public.fixed_savings_program%ROWTYPE;
  v_new public.fixed_savings_program%ROWTYPE;
  v_version text := nullif(trim(p_terms_version),'');
  v_url text := nullif(trim(p_terms_url),'');
  v_days integer[];
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=v_admin AND role='admin' AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active Super Admin access required' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_old FROM public.fixed_savings_program WHERE singleton FOR UPDATE;
  IF p_revision IS DISTINCT FROM v_old.revision THEN RAISE EXCEPTION 'Ice Vault settings changed. Reload and try again.'; END IF;

  IF p_enabled IS NULL OR p_min_amount IS NULL OR p_max_amount IS NULL OR p_max_wallet_locked IS NULL
    OR p_min_amount NOT BETWEEN 1 AND 999999999999.99 OR p_max_amount NOT BETWEEN p_min_amount AND 999999999999.99
    OR p_max_wallet_locked NOT BETWEEN p_max_amount AND 999999999999.99
    OR p_min_amount<>round(p_min_amount,2) OR p_max_amount<>round(p_max_amount,2) OR p_max_wallet_locked<>round(p_max_wallet_locked,2)
    OR p_max_active_locks IS NULL OR p_max_active_locks NOT BETWEEN 1 AND 100
    OR p_allowed_days IS NULL OR cardinality(p_allowed_days) NOT BETWEEN 1 AND 5
    OR NOT (p_allowed_days <@ ARRAY[7,14,30,60,90]) OR array_position(p_allowed_days,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Enter valid Ice Vault limits and choose at least one duration.';
  END IF;

  IF (v_version IS NULL) <> (v_url IS NULL) OR (p_enabled AND v_version IS NULL) OR length(v_version)>80 OR length(v_url)>2048
    OR (v_url IS NOT NULL AND v_url !~ '^https://[A-Za-z0-9.-]+([/:?#][^[:space:]]*)?$') THEN
    RAISE EXCEPTION 'Enter a terms version and a secure HTTPS terms URL.';
  END IF;

  IF v_version IS NOT NULL THEN
    INSERT INTO public.fixed_savings_terms(version,document_url) VALUES (v_version,v_url) ON CONFLICT (version) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.fixed_savings_terms WHERE version=v_version AND document_url=v_url) THEN
      RAISE EXCEPTION 'This version already points to a different document. Use a new version.';
    END IF;
  END IF;
  SELECT array_agg(DISTINCT term ORDER BY term) INTO v_days FROM unnest(p_allowed_days) AS term;

  UPDATE public.fixed_savings_program SET enabled=p_enabled,min_amount=p_min_amount,max_amount=p_max_amount,
    max_wallet_locked=p_max_wallet_locked,max_active_locks=p_max_active_locks,allowed_days=v_days,
    terms_version=v_version,revision=revision+1 WHERE singleton RETURNING * INTO v_new;

  INSERT INTO public.fixed_savings_settings_audit(revision,changed_by,previous,updated)
  VALUES (v_new.revision,v_admin,public.fixed_savings_admin_settings(v_old),public.fixed_savings_admin_settings(v_new));

  RETURN public.fixed_savings_admin_settings(v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.fixed_savings_admin_settings(public.fixed_savings_program),
  public.admin_get_fixed_savings(),public.admin_save_fixed_savings(integer,boolean,numeric,numeric,numeric,integer,integer[],text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_fixed_savings(),
  public.admin_save_fixed_savings(integer,boolean,numeric,numeric,numeric,integer,integer[],text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
