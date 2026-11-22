BEGIN;

CREATE TABLE public.fixed_savings_terms (
  version text PRIMARY KEY CHECK (length(trim(version)) BETWEEN 1 AND 80),
  document_url text NOT NULL CHECK (document_url ~ '^https://[A-Za-z0-9.-]+([/:?#][^[:space:]]*)?$' AND length(document_url)<=2048)
);

CREATE FUNCTION public.guard_fixed_savings_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Register a new version of the Ice Vault terms';
END;
$$;
CREATE TRIGGER preserve_fixed_savings_terms BEFORE UPDATE OR DELETE ON public.fixed_savings_terms
FOR EACH ROW EXECUTE FUNCTION public.guard_fixed_savings_terms();

CREATE TABLE public.fixed_savings_program (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  settlement_mode text NOT NULL DEFAULT 'wallet_ledger' CHECK (settlement_mode IN ('wallet_ledger','partner_api')),
  partner_code text,
  custodian_name text,
  approval_reference text,
  scheduler_seen_at timestamptz,
  adapter_seen_at timestamptz,
  adapter_seen_partner text,
  terms_version text REFERENCES public.fixed_savings_terms(version),
  revision integer NOT NULL DEFAULT 0,
  min_amount numeric(15,2) NOT NULL DEFAULT 1 CHECK (min_amount>=1),
  max_amount numeric(15,2) NOT NULL DEFAULT 500000 CHECK (max_amount>=min_amount),
  max_wallet_locked numeric(15,2) NOT NULL DEFAULT 1000000 CHECK (max_wallet_locked>=max_amount),
  max_active_locks integer NOT NULL DEFAULT 10 CHECK (max_active_locks BETWEEN 1 AND 100),
  allowed_days integer[] NOT NULL DEFAULT ARRAY[7,14,30,60,90]
    CHECK (cardinality(allowed_days) BETWEEN 1 AND 5 AND allowed_days <@ ARRAY[7,14,30,60,90] AND array_position(allowed_days,NULL) IS NULL),
  CHECK (NOT enabled OR (
    terms_version IS NOT NULL
    AND (settlement_mode='wallet_ledger' OR (nullif(trim(partner_code),'') IS NOT NULL AND nullif(trim(custodian_name),'') IS NOT NULL))
  ))
);
INSERT INTO public.fixed_savings_program DEFAULT VALUES;

CREATE TABLE public.fixed_savings_quotes (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  days integer NOT NULL CHECK (days IN (7,14,30,60,90)),
  maturity_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  terms_version text NOT NULL REFERENCES public.fixed_savings_terms(version),
  program_revision integer NOT NULL,
  settlement_mode text NOT NULL CHECK (settlement_mode IN ('wallet_ledger','partner_api')),
  partner_code text,
  custodian_name text,
  approval_reference text
);

CREATE TABLE public.fixed_savings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  days integer NOT NULL CHECK (days IN (7,14,30,60,90)),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  maturity_at timestamptz NOT NULL CHECK (maturity_at > requested_at),
  status text NOT NULL CHECK (status IN ('reserving','active','matured','withdrawn','failed')),
  terms_version text NOT NULL REFERENCES public.fixed_savings_terms(version),
  settlement_mode text NOT NULL CHECK (settlement_mode IN ('wallet_ledger','partner_api')),
  partner_code text,
  custodian_name text,
  approval_reference text,
  reserve_reference text,
  release_reference text,
  locked_at timestamptz,
  matured_at timestamptz,
  credited_at timestamptz,
  withdrawn_at timestamptz,
  CHECK (settlement_mode<>'partner_api' OR partner_code IS NOT NULL),
  CHECK (status<>'reserving' OR settlement_mode='partner_api'),
  CHECK (status NOT IN ('active','matured','withdrawn') OR
    (locked_at IS NOT NULL AND (settlement_mode='wallet_ledger' OR reserve_reference IS NOT NULL))),
  CHECK (status NOT IN ('matured','withdrawn') OR (matured_at >= maturity_at AND matured_at IS NOT NULL
    AND (settlement_mode='wallet_ledger' AND credited_at IS NOT NULL OR settlement_mode='partner_api' AND release_reference IS NOT NULL))),
  CHECK (credited_at IS NULL OR (matured_at IS NOT NULL AND credited_at>=matured_at)),
  CHECK (status <> 'withdrawn' OR (withdrawn_at >= matured_at AND withdrawn_at IS NOT NULL))
);
CREATE INDEX fixed_savings_user_history ON public.fixed_savings(user_id,requested_at DESC,id DESC);
CREATE INDEX fixed_savings_due ON public.fixed_savings(maturity_at,id) WHERE status='active';
CREATE INDEX fixed_savings_held_by_owner ON public.fixed_savings(user_id) WHERE status IN ('reserving','active') OR (status='matured' AND credited_at IS NULL);
CREATE INDEX fixed_savings_recent_intent ON public.fixed_savings(user_id,amount,days,requested_at DESC) WHERE status<>'failed';
CREATE UNIQUE INDEX fixed_savings_transaction_reference ON public.transactions(reference_id) WHERE payment_method='fixed_savings';

CREATE TABLE public.fixed_savings_events (
  savings_id uuid NOT NULL REFERENCES public.fixed_savings(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('authorised','locked','maturing','release_requested','matured','withdrawn','reservation_failed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  transaction_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  PRIMARY KEY (savings_id,event)
);

-- Durable outbox. The approved provider adapter uses each job ID as its provider idempotency key.
CREATE TABLE public.fixed_savings_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_id uuid NOT NULL REFERENCES public.fixed_savings(id) ON DELETE RESTRICT,
  partner_code text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('reserve','release')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamptz,
  outcome text CHECK (outcome IN ('confirmed','rejected')),
  provider_event_ref text,
  UNIQUE (savings_id,operation),
  UNIQUE (partner_code,operation,provider_event_ref)
);
CREATE INDEX fixed_savings_jobs_due ON public.fixed_savings_jobs(partner_code,next_attempt_at,id) WHERE outcome IS NULL;

ALTER TABLE public.fixed_savings_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_savings_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_savings_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_savings_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_savings_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fixed_savings_terms, public.fixed_savings_program, public.fixed_savings_quotes, public.fixed_savings,
  public.fixed_savings_events, public.fixed_savings_jobs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.fixed_savings_program_ready(p_program public.fixed_savings_program)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce(p_program.enabled AND p_program.scheduler_seen_at>=now()-interval '5 minutes'
    AND (p_program.settlement_mode='wallet_ledger' OR (p_program.adapter_seen_partner=p_program.partner_code
      AND p_program.adapter_seen_at>=now()-interval '5 minutes')),false)
$$;

-- Both quote and confirmation run this under the same wallet row lock used by debits.
CREATE FUNCTION public.fixed_savings_limit_error(p_user uuid,p_amount numeric,p_days integer,p_program public.fixed_savings_program)
RETURNS text LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
  v_held numeric;
  v_count integer;
BEGIN
  IF p_amount IS NULL OR p_amount NOT BETWEEN p_program.min_amount AND p_program.max_amount OR p_amount<>round(p_amount,2)
    OR p_days IS NULL OR NOT (p_days=ANY(p_program.allowed_days)) THEN
    RETURN 'Choose an available period and an amount within your Ice Vault limits.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fixed_savings WHERE user_id=p_user
    AND amount=p_amount AND days=p_days AND status<>'failed'
    AND requested_at>=statement_timestamp()-interval '10 minutes') THEN
    RETURN 'A lock for this amount and period was already submitted. Check your vault.';
  END IF;
  SELECT coalesce(sum(amount),0),count(*) INTO v_held,v_count FROM public.fixed_savings WHERE user_id=p_user
    AND (status IN ('active','reserving') OR (status='matured' AND credited_at IS NULL));
  IF v_count>=p_program.max_active_locks OR v_held+p_amount>p_program.max_wallet_locked THEN
    RETURN 'This lock would exceed your Ice Vault balance or active lock limit.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.get_my_fixed_savings(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_totals jsonb;
  v_items jsonb;
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
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton;
  RETURN jsonb_build_object('enabled',public.fixed_savings_program_ready(v_program),'totals',v_totals,
    'items',v_items,'server_now',statement_timestamp(),'limits',
    jsonb_build_object('min_amount',v_program.min_amount,'max_amount',v_program.max_amount,'allowed_days',v_program.allowed_days));
END;
$$;

CREATE FUNCTION public.quote_fixed_savings(p_amount numeric,p_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_program public.fixed_savings_program%ROWTYPE;
  v_quote public.fixed_savings_quotes%ROWTYPE;
  v_wallet numeric;
  v_terms_url text;
  v_error text;
  v_now timestamptz := date_trunc('second',statement_timestamp());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
  SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id=v_uid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','An active wallet is required.'); END IF;
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton FOR SHARE;
  IF NOT public.fixed_savings_program_ready(v_program) THEN RETURN jsonb_build_object('error','New Ice Vault locks are unavailable.'); END IF;
  v_error := public.fixed_savings_limit_error(v_uid,p_amount,p_days,v_program);
  IF v_error IS NOT NULL THEN RETURN jsonb_build_object('error',v_error); END IF;
  SELECT document_url INTO v_terms_url FROM public.fixed_savings_terms WHERE version=v_program.terms_version;
  IF v_wallet IS NULL OR v_wallet<p_amount THEN RETURN jsonb_build_object('error','Your available wallet balance cannot cover this lock.'); END IF;
  SELECT * INTO v_quote FROM public.fixed_savings_quotes WHERE user_id=v_uid
    AND expires_at>clock_timestamp() AND amount=p_amount AND days=p_days
    AND program_revision=v_program.revision AND terms_version=v_program.terms_version
    AND settlement_mode=v_program.settlement_mode AND partner_code IS NOT DISTINCT FROM v_program.partner_code
    AND custodian_name IS NOT DISTINCT FROM v_program.custodian_name AND approval_reference IS NOT DISTINCT FROM v_program.approval_reference;
  IF NOT FOUND THEN
    INSERT INTO public.fixed_savings_quotes(user_id,id,amount,days,maturity_at,expires_at,terms_version,program_revision,settlement_mode,
    partner_code,custodian_name,approval_reference)
    VALUES (v_uid,gen_random_uuid(),p_amount,p_days,v_now+make_interval(hours=>24*p_days),
    v_now+interval '10 minutes',v_program.terms_version,v_program.revision,v_program.settlement_mode,v_program.partner_code,
    v_program.custodian_name,v_program.approval_reference)
    ON CONFLICT (user_id) DO UPDATE SET id=EXCLUDED.id,amount=EXCLUDED.amount,days=EXCLUDED.days,
    maturity_at=EXCLUDED.maturity_at,expires_at=EXCLUDED.expires_at,terms_version=EXCLUDED.terms_version,
    settlement_mode=EXCLUDED.settlement_mode,partner_code=EXCLUDED.partner_code,custodian_name=EXCLUDED.custodian_name,
    approval_reference=EXCLUDED.approval_reference,program_revision=EXCLUDED.program_revision
    RETURNING * INTO v_quote;
  END IF;
  RETURN jsonb_build_object('id',v_quote.id,'amount',v_quote.amount,'days',v_quote.days,'maturity_at',v_quote.maturity_at,
    'expires_at',v_quote.expires_at,'terms_version',v_quote.terms_version,'terms_url',v_terms_url,
    'settlement_mode',v_quote.settlement_mode,'custodian_name',v_quote.custodian_name);
END;
$$;

CREATE FUNCTION public.fixed_savings_wallet_entry(p_user uuid,p_savings uuid,p_amount numeric,p_event text,
  p_description text,p_before numeric,p_after numeric)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.transactions(user_id,type,amount,description,status,payment_method,reference_id,balance_before,balance_after,metadata)
  VALUES (p_user,CASE WHEN p_after<p_before THEN 'withdrawal' ELSE 'deposit' END,
    p_amount,p_description,'completed','fixed_savings','FIXED_SAVINGS_'||p_event||'_'||p_savings,p_before,p_after,
    jsonb_build_object('fixed_savings_id',p_savings,'fixed_savings_event',p_event))
  RETURNING id
$$;

CREATE FUNCTION public.open_fixed_savings(p_quote_id uuid,p_terms_version text,p_accepted boolean,p_pin text)
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
    RETURN jsonb_build_object('error','This quote expired. Review a new maturity time.');
  END IF;
  IF p_accepted IS DISTINCT FROM true OR p_terms_version IS DISTINCT FROM v_quote.terms_version THEN
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

CREATE FUNCTION public.notify_fixed_savings(p_user uuid,p_savings uuid,p_type text,p_title text,p_message text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.notifications (user_id,type,title,message,related_id)
  VALUES (p_user,p_type,p_title,p_message,p_savings)
$$;

-- Callers hold the owner's wallet row lock before locking the savings row.
CREATE FUNCTION public.credit_matured_wallet_savings(p_user uuid,p_savings uuid,p_wallet numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_s public.fixed_savings%ROWTYPE;
  v_before numeric := coalesce(p_wallet,0);
  v_settled_at timestamptz := clock_timestamp();
  v_tx uuid;
BEGIN
  SELECT * INTO v_s FROM public.fixed_savings
  WHERE id=p_savings AND user_id=p_user AND settlement_mode='wallet_ledger'
    AND status='active' AND maturity_at<=v_settled_at
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

CREATE FUNCTION public.service_schedule_fixed_savings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_s public.fixed_savings%ROWTYPE;
  v_wallet numeric;
  v_count integer := 0;
  v_wallet_error boolean := false;
BEGIN
  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.settlement_mode='wallet_ledger' AND s.maturity_at<=now()
    ORDER BY s.maturity_at,s.id LIMIT 200
  LOOP
    BEGIN
      SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id=v_s.user_id FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF public.credit_matured_wallet_savings(v_s.user_id,v_s.id,v_wallet) THEN
        v_count := v_count+1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_wallet_error := true;
      RAISE WARNING 'Ice Vault maturity failed for lock % (SQLSTATE %)',v_s.id,SQLSTATE;
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
  IF NOT v_wallet_error THEN
    UPDATE public.fixed_savings_program SET scheduler_seen_at=clock_timestamp() WHERE singleton;
  END IF;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.service_claim_fixed_savings_jobs(p_partner_code text)
RETURNS TABLE (job_id uuid,lease_id uuid,savings_id uuid,user_id uuid,amount numeric,currency text,
  operation text,maturity_at timestamptz,reserve_reference text)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH heartbeat AS (
    UPDATE public.fixed_savings_program SET adapter_seen_at=now(),adapter_seen_partner=p_partner_code
    WHERE singleton AND settlement_mode='partner_api' AND partner_code=p_partner_code RETURNING singleton
  ), candidates AS (
    SELECT j.id FROM public.fixed_savings_jobs j WHERE j.partner_code=p_partner_code
      AND j.outcome IS NULL AND j.next_attempt_at<=now() AND (j.lease_until IS NULL OR j.lease_until<=now())
    ORDER BY j.next_attempt_at,j.id LIMIT 20 FOR UPDATE SKIP LOCKED
  ), taken AS (
    UPDATE public.fixed_savings_jobs j SET lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=j.attempts+1
    FROM candidates c WHERE c.id=j.id RETURNING j.*
  )
  SELECT j.id,j.lease_id,s.id,s.user_id,s.amount,'NGN'::text,j.operation,s.maturity_at,s.reserve_reference
  FROM taken j JOIN public.fixed_savings s ON s.id=j.savings_id
$$;

-- Called only by a trusted adapter after it verifies the provider's durable operation status.
-- A timeout is a retry, never a rejection. Release is credited only after provider confirmation.
CREATE FUNCTION public.service_settle_fixed_savings_job(p_job_id uuid,p_lease_id uuid,p_partner_code text,
  p_result text,p_amount numeric,p_currency text,p_provider_reference text,
  p_maturity_at timestamptz DEFAULT NULL,p_reserve_reference text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid;
  v_wallet numeric;
  v_job public.fixed_savings_jobs%ROWTYPE;
  v_s public.fixed_savings%ROWTYPE;
  v_tx uuid;
BEGIN
  SELECT s.user_id INTO v_uid FROM public.fixed_savings_jobs j JOIN public.fixed_savings s ON s.id=j.savings_id
  WHERE j.id=p_job_id AND j.partner_code=p_partner_code;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id=v_uid FOR UPDATE;
  SELECT * INTO v_job FROM public.fixed_savings_jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.lease_id IS DISTINCT FROM p_lease_id OR p_lease_id IS NULL THEN RETURN false; END IF;
  IF v_job.outcome IS NOT NULL THEN RETURN v_job.outcome=p_result AND v_job.provider_event_ref IS NOT DISTINCT FROM p_provider_reference; END IF;
  IF v_job.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO v_s FROM public.fixed_savings WHERE id=v_job.savings_id FOR UPDATE;
  IF v_s.settlement_mode IS DISTINCT FROM 'partner_api' THEN RETURN false; END IF;
  IF p_result='retry' OR (p_result='rejected' AND v_job.operation='release') THEN
    UPDATE public.fixed_savings_jobs SET lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=p_job_id;
    RETURN true;
  END IF;
  IF p_result IS NULL OR p_result NOT IN ('confirmed','rejected') OR p_amount IS DISTINCT FROM v_s.amount
    OR p_currency IS DISTINCT FROM 'NGN' OR nullif(trim(p_provider_reference),'') IS NULL THEN RETURN false; END IF;
  IF p_result='confirmed' AND (p_maturity_at IS DISTINCT FROM v_s.maturity_at OR
    (v_job.operation='release' AND p_reserve_reference IS DISTINCT FROM v_s.reserve_reference)) THEN RETURN false; END IF;

  IF v_job.operation='reserve' AND v_s.status='reserving' THEN
    IF p_result='confirmed' THEN
      UPDATE public.fixed_savings SET status='active',locked_at=clock_timestamp(),reserve_reference=p_provider_reference WHERE id=v_s.id;
      INSERT INTO public.fixed_savings_events(savings_id,event) VALUES(v_s.id,'locked');
      PERFORM public.notify_fixed_savings(v_uid,v_s.id,'fixed_savings_locked','Savings locked',
        'Your Ice Vault lock is confirmed. The maturity time is in the app.');
    ELSE
      UPDATE public.profiles SET wallet_balance=coalesce(wallet_balance,0)+v_s.amount,updated_at=now() WHERE id=v_uid;
      v_tx := public.fixed_savings_wallet_entry(v_uid,v_s.id,v_s.amount,'return',
        'Ice Vault reservation returned',coalesce(v_wallet,0),coalesce(v_wallet,0)+v_s.amount);
      UPDATE public.fixed_savings SET status='failed' WHERE id=v_s.id;
      INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES (v_s.id,'reservation_failed',v_tx);
      PERFORM public.notify_fixed_savings(v_uid,v_s.id,'fixed_savings_returned','Savings reservation returned',
        'The lock could not be confirmed. The principal is available in your wallet.');
    END IF;
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

CREATE FUNCTION public.withdraw_fixed_savings(p_savings_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_s public.fixed_savings%ROWTYPE;
  v_tx uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_profile.status IS DISTINCT FROM 'active' THEN RETURN jsonb_build_object('error','An active wallet is required.'); END IF;
  SELECT * INTO v_s FROM public.fixed_savings WHERE id=p_savings_id AND user_id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','This savings lock is unavailable.'); END IF;
  IF v_s.credited_at IS NOT NULL THEN RETURN jsonb_build_object('id',v_s.id,'amount',v_s.amount); END IF;
  IF v_s.settlement_mode='wallet_ledger' AND public.credit_matured_wallet_savings(v_uid,v_s.id,v_profile.wallet_balance) THEN
    RETURN jsonb_build_object('id',v_s.id,'amount',v_s.amount);
  END IF;
  IF v_s.status<>'matured' OR v_s.maturity_at>clock_timestamp() THEN
    RETURN jsonb_build_object('error','This savings lock is not available for withdrawal yet.');
  END IF;
  UPDATE public.profiles SET wallet_balance=coalesce(wallet_balance,0)+v_s.amount,updated_at=now() WHERE id=v_uid;
  v_tx := public.fixed_savings_wallet_entry(v_uid,v_s.id,v_s.amount,'withdrawal',
    'Ice Vault withdrawn to wallet',coalesce(v_profile.wallet_balance,0),coalesce(v_profile.wallet_balance,0)+v_s.amount);
  UPDATE public.fixed_savings SET status='withdrawn',withdrawn_at=clock_timestamp(),credited_at=clock_timestamp() WHERE id=v_s.id;
  INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES (v_s.id,'withdrawn',v_tx);
  RETURN jsonb_build_object('id',v_s.id,'amount',v_s.amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE
    WHEN left(p_type,14)='fixed_savings_' OR p_type IN ('wallet_deposit','transfer_completed','transfer_failed','wallet_debit','wallet_credit','refund_completed') THEN 'wallet'
    WHEN p_type IN ('bank_transfer_received','group_payment_received','contribution_verified') THEN 'group'
    ELSE 'activity'
  END
$$;

REVOKE ALL ON FUNCTION public.guard_fixed_savings_terms(),public.fixed_savings_program_ready(public.fixed_savings_program),
  public.get_my_fixed_savings(timestamptz,uuid),public.credit_matured_wallet_savings(uuid,uuid,numeric),
  public.fixed_savings_limit_error(uuid,numeric,integer,public.fixed_savings_program),
  public.quote_fixed_savings(numeric,integer),public.fixed_savings_wallet_entry(uuid,uuid,numeric,text,text,numeric,numeric),
  public.open_fixed_savings(uuid,text,boolean,text),public.notify_fixed_savings(uuid,uuid,text,text,text),
  public.service_schedule_fixed_savings(),public.service_claim_fixed_savings_jobs(text),
  public.service_settle_fixed_savings_job(uuid,uuid,text,text,numeric,text,text,timestamptz,text),public.withdraw_fixed_savings(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_fixed_savings(timestamptz,uuid),public.quote_fixed_savings(numeric,integer),
  public.open_fixed_savings(uuid,text,boolean,text),public.withdraw_fixed_savings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_claim_fixed_savings_jobs(text),
  public.service_settle_fixed_savings_job(uuid,uuid,text,text,numeric,text,text,timestamptz,text) TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.schedule('collectipay-fixed-savings','* * * * *','select public.service_schedule_fixed_savings()');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
