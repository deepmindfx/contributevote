BEGIN;

-- Alert failures must not undo a wallet credit or stop the maturity sweep.
CREATE OR REPLACE FUNCTION public.notify_fixed_savings(p_user uuid,p_savings uuid,p_type text,p_title text,p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.notifications (user_id,type,title,message,related_id)
  VALUES (p_user,p_type,p_title,p_message,p_savings);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Ice Vault notification % failed for lock % (SQLSTATE %)',p_type,p_savings,SQLSTATE;
END;
$$;

-- Keep unsettled locks accessible even when recent history fills the first page.
CREATE OR REPLACE FUNCTION public.get_my_fixed_savings(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_totals jsonb;
  v_items jsonb;
  v_open_items jsonb := '[]'::jsonb;
  v_program public.fixed_savings_program%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to view Ice Vault' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'locked',coalesce(sum(s.amount) FILTER (WHERE s.status='active'),0),
    'pending',coalesce(sum(s.amount) FILTER (WHERE s.status='reserving'),0),
    'available',coalesce(sum(s.amount) FILTER (WHERE s.status='matured' AND s.credited_at IS NULL),0),
    'active_count',count(*) FILTER (WHERE s.status='active'))
  INTO v_totals FROM public.fixed_savings s WHERE s.user_id=v_uid;
  SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY rows.requested_at DESC,rows.id DESC),'[]'::jsonb)
  INTO v_items FROM (
    SELECT id,amount,days,requested_at,maturity_at,status,settlement_mode,custodian_name,locked_at,matured_at,credited_at,withdrawn_at
    FROM public.fixed_savings s WHERE s.user_id=v_uid
      AND (p_before IS NULL OR (s.requested_at,s.id) < (p_before,p_before_id))
    ORDER BY s.requested_at DESC,s.id DESC LIMIT 24
  ) rows;
  IF p_before IS NULL THEN
    SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY rows.requested_at DESC,rows.id DESC),'[]'::jsonb)
    INTO v_open_items FROM (
      SELECT id,amount,days,requested_at,maturity_at,status,settlement_mode,custodian_name,locked_at,matured_at,credited_at,withdrawn_at
      FROM public.fixed_savings s WHERE s.user_id=v_uid
        AND (s.status IN ('reserving','active') OR (s.status='matured' AND s.credited_at IS NULL))
    ) rows;
  END IF;
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton;
  RETURN jsonb_build_object('enabled',public.fixed_savings_program_ready(v_program),'totals',v_totals,
    'items',v_items,'open_items',v_open_items,'server_now',statement_timestamp(),'limits',
    jsonb_build_object('min_amount',v_program.min_amount,'max_amount',v_program.max_amount,'allowed_days',v_program.allowed_days));
END;
$$;

COMMIT;
