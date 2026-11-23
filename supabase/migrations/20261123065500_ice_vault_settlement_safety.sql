BEGIN;

CREATE OR REPLACE FUNCTION public.credit_matured_wallet_savings(p_user uuid,p_savings uuid,p_wallet numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_s public.fixed_savings%ROWTYPE;
  v_before numeric;
  v_settled_at timestamptz := clock_timestamp();
  v_tx uuid;
BEGIN
  SELECT coalesce(wallet_balance,0) INTO v_before FROM public.profiles WHERE id=p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_s FROM public.fixed_savings
  WHERE id=p_savings AND user_id=p_user AND settlement_mode='wallet_ledger'
    AND status='active' AND credited_at IS NULL AND maturity_at<=v_settled_at
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles SET wallet_balance=v_before+v_s.amount,updated_at=v_settled_at WHERE id=p_user;
  v_tx := public.fixed_savings_wallet_entry(p_user,v_s.id,v_s.amount,'maturity',
    'Ice Vault matured into wallet',v_before,v_before+v_s.amount);
  UPDATE public.fixed_savings SET status='matured',matured_at=v_settled_at,credited_at=v_settled_at WHERE id=v_s.id;
  INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES (v_s.id,'matured',v_tx);
  PERFORM public.notify_fixed_savings(p_user,v_s.id,'fixed_savings_matured','Savings now in your wallet',
    'Your lock has matured and the full principal is available in your wallet.');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_settle_fixed_savings_job(p_job_id uuid,p_lease_id uuid,p_partner_code text,
  p_result text,p_amount numeric,p_currency text,p_provider_reference text,
  p_maturity_at timestamptz DEFAULT NULL,p_reserve_reference text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid;
  v_job public.fixed_savings_jobs%ROWTYPE;
  v_s public.fixed_savings%ROWTYPE;
BEGIN
  SELECT s.user_id INTO v_uid FROM public.fixed_savings_jobs j JOIN public.fixed_savings s ON s.id=j.savings_id
  WHERE j.id=p_job_id AND j.partner_code=p_partner_code;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_job FROM public.fixed_savings_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.lease_id IS DISTINCT FROM p_lease_id OR p_lease_id IS NULL THEN RETURN false; END IF;
  IF v_job.outcome IS NOT NULL THEN RETURN v_job.outcome=p_result AND v_job.provider_event_ref IS NOT DISTINCT FROM p_provider_reference; END IF;
  IF v_job.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO v_s FROM public.fixed_savings WHERE id=v_job.savings_id FOR UPDATE;
  IF v_s.settlement_mode IS DISTINCT FROM 'partner_api' THEN RETURN false; END IF;
  IF p_result IN ('retry','rejected') THEN
    UPDATE public.fixed_savings_jobs SET lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=p_job_id;
    RETURN true;
  END IF;
  IF p_result IS NULL OR p_result<>'confirmed' OR p_amount IS DISTINCT FROM v_s.amount
    OR p_currency IS DISTINCT FROM 'NGN' OR nullif(trim(p_provider_reference),'') IS NULL THEN RETURN false; END IF;
  IF p_result='confirmed' AND (p_maturity_at IS DISTINCT FROM v_s.maturity_at OR
    (v_job.operation='release' AND p_reserve_reference IS DISTINCT FROM v_s.reserve_reference)) THEN RETURN false; END IF;

  IF v_job.operation='reserve' AND v_s.status='reserving' THEN
    UPDATE public.fixed_savings SET status='active',locked_at=clock_timestamp(),reserve_reference=p_provider_reference WHERE id=v_s.id;
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES(v_s.id,'locked');
    PERFORM public.notify_fixed_savings(v_uid,v_s.id,'fixed_savings_locked','Savings locked',
      'Your Ice Vault lock is confirmed. The maturity time is in the app.');
  ELSIF v_job.operation='release' AND v_s.status='active' AND v_s.maturity_at<=clock_timestamp() AND p_result='confirmed' THEN
    UPDATE public.fixed_savings SET status='matured',matured_at=clock_timestamp(),release_reference=p_provider_reference WHERE id=v_s.id;
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES(v_s.id,'matured');
    PERFORM public.notify_fixed_savings(v_uid,v_s.id,'fixed_savings_matured','Savings ready to withdraw',
      'Your Ice Vault has matured. Move the principal to your wallet when ready.');
  ELSE
    RETURN false;
  END IF;
  UPDATE public.fixed_savings_jobs SET outcome=p_result,provider_event_ref=p_provider_reference,lease_until=NULL WHERE id=p_job_id;
  RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
