BEGIN;

ALTER TABLE public.fixed_savings ADD COLUMN maturity_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.service_schedule_fixed_savings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_due record;
  v_s public.fixed_savings%ROWTYPE;
  v_wallet numeric;
  v_count integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(20261122,21451) THEN RETURN 0; END IF;

  -- Apply the limit after skipping busy wallets and defer individual errors.
  -- Every credit still locks the wallet before locking the savings row.
  FOR v_due IN
    SELECT s.id,s.user_id FROM public.fixed_savings s JOIN public.profiles p ON p.id=s.user_id
    WHERE s.status='active' AND s.settlement_mode='wallet_ledger' AND s.maturity_at<=now()
      AND (s.maturity_retry_at IS NULL OR s.maturity_retry_at<=now())
    ORDER BY s.maturity_at,s.id LIMIT 200 FOR UPDATE OF p SKIP LOCKED
  LOOP
    BEGIN
      SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id=v_due.user_id;
      IF public.credit_matured_wallet_savings(v_due.user_id,v_due.id,v_wallet) THEN
        v_count := v_count+1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fixed_savings SET maturity_retry_at=clock_timestamp()+interval '5 minutes' WHERE id=v_due.id;
      RAISE WARNING 'Ice Vault maturity failed for lock % (SQLSTATE %)',v_due.id,SQLSTATE;
    END;
  END LOOP;
  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.settlement_mode='partner_api' AND s.maturity_at<=now()
      AND NOT EXISTS (SELECT 1 FROM public.fixed_savings_jobs j WHERE j.savings_id=s.id AND j.operation='release')
    ORDER BY s.maturity_at,s.id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.fixed_savings_jobs(savings_id,partner_code,operation) VALUES(v_s.id,v_s.partner_code,'release');
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES (v_s.id,'release_requested');
    v_count := v_count+1;
  END LOOP;
  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.maturity_at>now() AND s.maturity_at<=now()+interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.fixed_savings_events e WHERE e.savings_id=s.id AND e.event='maturing')
    ORDER BY s.maturity_at,s.id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES (v_s.id,'maturing');
    PERFORM public.notify_fixed_savings(v_s.user_id,v_s.id,'fixed_savings_maturing','Savings matures soon',
      'Your lock is due to mature within the next 24 hours.');
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.fixed_savings WHERE status='active' AND settlement_mode='wallet_ledger'
    AND maturity_retry_at IS NOT NULL) THEN
    UPDATE public.fixed_savings_program SET scheduler_seen_at=clock_timestamp() WHERE singleton;
  END IF;
  RETURN v_count;
END;
$$;

COMMIT;
