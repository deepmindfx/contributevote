BEGIN;

ALTER TABLE public.fixed_savings_quotes ADD COLUMN terms_reviewed_at timestamptz;
CREATE FUNCTION public.review_fixed_savings_terms(p_quote_id uuid,p_terms_version text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.fixed_savings_quotes SET terms_reviewed_at=coalesce(terms_reviewed_at,clock_timestamp())
    WHERE id=p_quote_id AND user_id=auth.uid() AND terms_version=p_terms_version AND expires_at>clock_timestamp();
  IF FOUND THEN RETURN true; END IF;
  -- An ambiguous confirmation may already have settled. The accepted quote can still be replayed.
  RETURN EXISTS (SELECT FROM public.fixed_savings WHERE id=p_quote_id AND user_id=auth.uid() AND terms_version=p_terms_version);
END;
$$;
REVOKE ALL ON FUNCTION public.review_fixed_savings_terms(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_fixed_savings_terms(uuid,text) TO authenticated;

CREATE FUNCTION public.reset_fixed_savings_terms_review()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.terms_version IS DISTINCT FROM OLD.terms_version THEN
    NEW.terms_reviewed_at:=NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reset_fixed_savings_terms_review BEFORE UPDATE OF id,terms_version ON public.fixed_savings_quotes
  FOR EACH ROW EXECUTE FUNCTION public.reset_fixed_savings_terms_review();
REVOKE ALL ON FUNCTION public.reset_fixed_savings_terms_review() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.confirm_reviewed_fixed_savings(p_quote_id uuid,p_terms_version text,p_accepted boolean,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_program public.fixed_savings_program%ROWTYPE;
  v_quote public.fixed_savings_quotes%ROWTYPE;
  v_tx uuid;
  v_pin json;
  v_status text;
  v_error text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_profile.status IS DISTINCT FROM 'active' THEN RETURN jsonb_build_object('error','An active wallet is required.'); END IF;
  SELECT status INTO v_status FROM public.fixed_savings WHERE id=p_quote_id AND user_id=v_uid;
  IF FOUND THEN RETURN jsonb_build_object('id',p_quote_id,'status',v_status); END IF;
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton FOR SHARE;
  IF NOT public.fixed_savings_program_ready(v_program) THEN RETURN jsonb_build_object('error','New savings locks are unavailable.'); END IF;
  SELECT * INTO v_quote FROM public.fixed_savings_quotes WHERE user_id=v_uid AND id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.expires_at<=clock_timestamp() OR v_quote.terms_version IS DISTINCT FROM v_program.terms_version
    OR v_quote.program_revision IS DISTINCT FROM v_program.revision
    OR v_quote.settlement_mode IS DISTINCT FROM v_program.settlement_mode
    OR v_quote.partner_code IS DISTINCT FROM v_program.partner_code
    OR v_quote.custodian_name IS DISTINCT FROM v_program.custodian_name
    OR v_quote.approval_reference IS DISTINCT FROM v_program.approval_reference THEN
    RETURN jsonb_build_object('code','stale_quote','error','This quote expired. Review a new maturity time.');
  END IF;
  IF v_quote.terms_reviewed_at IS NULL OR p_accepted IS DISTINCT FROM true OR p_terms_version IS DISTINCT FROM v_quote.terms_version THEN
    RETURN jsonb_build_object('error','Accept the savings terms and exact maturity time before confirming.');
  END IF;
  IF v_profile.wallet_balance IS NULL OR v_profile.wallet_balance<v_quote.amount THEN RETURN jsonb_build_object('error','Insufficient available wallet balance.'); END IF;
  v_error := public.fixed_savings_limit_error(v_uid,v_quote.amount,v_quote.days,v_program);
  IF v_error IS NOT NULL THEN RETURN jsonb_build_object('error',v_error); END IF;
  v_pin := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin::jsonb; END IF;

  v_status := CASE WHEN v_quote.settlement_mode='wallet_ledger' THEN 'active' ELSE 'reserving' END;
  UPDATE public.profiles SET wallet_balance=wallet_balance-v_quote.amount,updated_at=now() WHERE id=v_uid;
  INSERT INTO public.fixed_savings(id,user_id,amount,days,maturity_at,status,terms_version,settlement_mode,
    partner_code,custodian_name,approval_reference,locked_at)
  VALUES (v_quote.id,v_uid,v_quote.amount,v_quote.days,v_quote.maturity_at,v_status,v_quote.terms_version,
    v_quote.settlement_mode,v_quote.partner_code,v_quote.custodian_name,v_quote.approval_reference,
    CASE WHEN v_status='active' THEN clock_timestamp() END);
  v_tx := public.fixed_savings_wallet_entry(v_uid,v_quote.id,v_quote.amount,'reservation',
    CASE WHEN v_status='active' THEN 'Ice Vault locked' ELSE 'Ice Vault reservation' END,
    v_profile.wallet_balance,v_profile.wallet_balance-v_quote.amount);
  INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES (v_quote.id,'authorised',v_tx);
  IF v_status='active' THEN
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES(v_quote.id,'locked');
    PERFORM public.notify_fixed_savings(v_uid,v_quote.id,'fixed_savings_locked','Savings locked',
      'Your Ice Vault lock is confirmed. The maturity time is in the app.');
  ELSE
    INSERT INTO public.fixed_savings_jobs(savings_id,partner_code,operation) VALUES (v_quote.id,v_quote.partner_code,'reserve');
  END IF;
  DELETE FROM public.fixed_savings_quotes WHERE user_id=v_uid AND id=v_quote.id;
  RETURN jsonb_build_object('id',v_quote.id,'status',v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_reviewed_fixed_savings(uuid,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_reviewed_fixed_savings(uuid,text,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.service_settle_fixed_savings_job(p_job_id uuid,p_lease_id uuid,p_partner_code text,
  p_result text,p_amount numeric,p_currency text,p_provider_reference text,
  p_maturity_at timestamptz DEFAULT NULL,p_reserve_reference text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid;
  v_job public.fixed_savings_jobs%ROWTYPE;
  v_s public.fixed_savings%ROWTYPE;
  v_wallet numeric;
  v_tx uuid;
  v_outcome text := CASE WHEN p_result='reserve_not_reserved' THEN 'rejected' ELSE p_result END;
BEGIN
  SELECT s.user_id INTO v_uid FROM public.fixed_savings_jobs j JOIN public.fixed_savings s ON s.id=j.savings_id
  WHERE j.id=p_job_id AND j.partner_code=p_partner_code;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT coalesce(wallet_balance,0) INTO v_wallet FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_job FROM public.fixed_savings_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.lease_id IS DISTINCT FROM p_lease_id OR p_lease_id IS NULL THEN RETURN false; END IF;
  IF v_job.outcome IS NOT NULL THEN RETURN v_job.outcome=v_outcome AND v_job.provider_event_ref IS NOT DISTINCT FROM p_provider_reference; END IF;
  IF v_job.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO v_s FROM public.fixed_savings WHERE id=v_job.savings_id FOR UPDATE;
  IF v_s.settlement_mode IS DISTINCT FROM 'partner_api' THEN RETURN false; END IF;
  IF p_result IN ('retry','rejected') THEN
    UPDATE public.fixed_savings_jobs SET lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=p_job_id;
    RETURN true;
  END IF;
  IF p_result IS NULL OR p_result NOT IN ('confirmed','reserve_not_reserved')
    OR p_amount IS DISTINCT FROM v_s.amount OR p_currency IS DISTINCT FROM 'NGN'
    OR length(btrim(coalesce(p_provider_reference,''))) NOT BETWEEN 1 AND 180 THEN RETURN false; END IF;

  -- The trusted adapter attests terminal no-reservation only after matching the original
  -- provider job key and obtaining final non-debit evidence. A generic rejection still retries.
  IF p_result='reserve_not_reserved' THEN
    IF v_job.operation<>'reserve' OR v_s.status<>'reserving' OR v_s.reserve_reference IS NOT NULL
      OR p_reserve_reference IS NOT NULL OR p_maturity_at IS DISTINCT FROM v_s.maturity_at THEN RETURN false; END IF;
    UPDATE public.profiles SET wallet_balance=v_wallet+v_s.amount,updated_at=now() WHERE id=v_uid;
    v_tx:=public.fixed_savings_wallet_entry(v_uid,v_s.id,v_s.amount,'return',
      'Ice Vault reservation returned',v_wallet,v_wallet+v_s.amount);
    UPDATE public.fixed_savings SET status='failed' WHERE id=v_s.id;
    INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES(v_s.id,'reservation_failed',v_tx);
    PERFORM public.notify_fixed_savings(v_uid,v_s.id,'fixed_savings_returned','Savings reservation returned',
      'The provider confirmed the lock was never reserved. Your principal is available in your wallet.');
    UPDATE public.fixed_savings_jobs SET outcome='rejected',provider_event_ref=p_provider_reference,lease_until=NULL WHERE id=v_job.id;
    RETURN true;
  END IF;
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

NOTIFY pgrst,'reload schema';
COMMIT;
