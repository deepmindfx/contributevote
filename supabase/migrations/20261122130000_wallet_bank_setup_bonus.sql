BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.wallet_bank_bonus_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  verification_ready boolean NOT NULL DEFAULT false,
  amount numeric(15,2) NOT NULL DEFAULT 500 CHECK (amount >= 100),
  claim_limit integer NOT NULL DEFAULT 100 CHECK (claim_limit > 0),
  identity_secret bytea NOT NULL DEFAULT extensions.gen_random_bytes(32)
);
INSERT INTO public.wallet_bank_bonus_settings DEFAULT VALUES;

CREATE TABLE public.wallet_bank_bonus_claims (
  user_id uuid PRIMARY KEY,
  identity_key bytea NOT NULL UNIQUE,
  provider_account_key bytea NOT NULL UNIQUE,
  transaction_id uuid NOT NULL UNIQUE,
  amount numeric(15,2) NOT NULL CHECK (amount >= 100),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_bank_bonus_verifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_key bytea NOT NULL,
  provider_reference text UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE public.wallet_bank_account_requests (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now()
);
-- Keep the keyed identity after account closure so the same BVN cannot claim again.
ALTER TABLE public.wallet_bank_bonus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_bank_bonus_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_bank_bonus_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_bank_account_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_bank_bonus_settings, public.wallet_bank_bonus_claims FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.wallet_bank_bonus_verifications, public.wallet_bank_account_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id,user_id,provider_reference,started_at), UPDATE (provider_reference)
  ON public.wallet_bank_bonus_verifications TO service_role;

CREATE FUNCTION public.wallet_has_personal_bank_account(p_preferences jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT coalesce(p_preferences #>> '{virtualAccount,accountNumber}', '') ~ '^[0-9]{10}$'
    OR coalesce(p_preferences #>> '{virtualAccount,accounts,0,accountNumber}', '') ~ '^[0-9]{10}$';
$$;

CREATE FUNCTION public.get_wallet_bank_bonus_offer()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object('amount', s.amount)
  FROM public.wallet_bank_bonus_settings s
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE s.singleton AND s.enabled AND s.verification_ready AND coalesce(p.status, 'active') = 'active'
    AND NOT public.wallet_has_personal_bank_account(p.preferences)
    AND NOT EXISTS (
      SELECT 1 FROM public.wallet_bank_bonus_claims c WHERE c.user_id = p.id
    )
    AND (SELECT count(*) FROM public.wallet_bank_bonus_claims) < s.claim_limit;
$$;

CREATE FUNCTION public.service_start_wallet_bonus_verification(p_user_id uuid, p_bvn text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_key bytea;
BEGIN
  IF p_bvn IS NULL OR p_bvn !~ '^[0-9]{11}$' OR p_id IS NULL THEN RETURN false; END IF;
  SELECT extensions.hmac(convert_to(p_bvn,'UTF8'), s.identity_secret,'sha256') INTO v_key
    FROM public.wallet_bank_bonus_settings s
    JOIN public.profiles p ON p.id = p_user_id
    JOIN auth.users u ON u.id = p_user_id
    WHERE s.singleton AND s.enabled AND s.verification_ready AND u.email_confirmed_at IS NOT NULL
      AND coalesce(p.status,'active') = 'active' AND NOT public.wallet_has_personal_bank_account(p.preferences)
      AND (SELECT count(*) FROM public.wallet_bank_bonus_claims) < s.claim_limit;
  IF v_key IS NULL OR EXISTS (
    SELECT 1 FROM public.wallet_bank_bonus_claims WHERE user_id = p_user_id OR identity_key = v_key
  ) THEN RETURN false; END IF;

  INSERT INTO public.wallet_bank_bonus_verifications (id,user_id,identity_key)
    VALUES (p_id,p_user_id,v_key)
    ON CONFLICT (user_id) DO UPDATE SET id = excluded.id, identity_key = excluded.identity_key,
      started_at = now(), provider_reference = NULL, confirmed_at = NULL
    WHERE wallet_bank_bonus_verifications.started_at < now() - interval '1 minute';
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.service_claim_wallet_account_setup(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user_id AND coalesce(status,'active') = 'active'
    AND NOT public.wallet_has_personal_bank_account(preferences) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.wallet_bank_account_requests (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET started_at = now()
    WHERE wallet_bank_account_requests.started_at < now() - interval '90 seconds';
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.service_confirm_wallet_bonus_verification(p_user_id uuid, p_id uuid, p_bvn text, p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_bvn IS NULL OR p_bvn !~ '^[0-9]{11}$' OR p_reference IS NULL THEN RETURN false; END IF;
  UPDATE public.wallet_bank_bonus_verifications v SET confirmed_at = now()
  FROM public.wallet_bank_bonus_settings s
  WHERE s.singleton AND v.id = p_id AND v.user_id = p_user_id AND v.provider_reference = p_reference
    AND v.started_at > now() - interval '30 minutes'
    AND v.identity_key = extensions.hmac(convert_to(p_bvn,'UTF8'),s.identity_secret,'sha256');
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.admin_wallet_bank_bonus_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN (
    SELECT jsonb_build_object('enabled', s.enabled, 'verification_ready', s.verification_ready, 'amount', s.amount, 'claim_limit', s.claim_limit,
      'claimed', c.claimed, 'remaining', greatest(s.claim_limit - c.claimed, 0), 'total_credited', c.total)
    FROM public.wallet_bank_bonus_settings s
    CROSS JOIN (SELECT count(*) AS claimed, coalesce(sum(amount), 0) AS total FROM public.wallet_bank_bonus_claims) c
    WHERE s.singleton
  );
END;
$$;

CREATE FUNCTION public.admin_update_wallet_bank_bonus(p_enabled boolean, p_amount numeric, p_claim_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_claimed bigint;
  v_ready boolean;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_enabled IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 9999999999999.99
    OR p_amount <> round(p_amount, 2) OR p_claim_limit IS NULL OR p_claim_limit < 1 THEN
    RAISE EXCEPTION 'Enter a bonus of at least ₦100 and a positive account limit.';
  END IF;

  SELECT verification_ready INTO v_ready FROM public.wallet_bank_bonus_settings WHERE singleton FOR UPDATE;
  IF p_enabled AND NOT v_ready THEN RAISE EXCEPTION 'Flutterwave BVN verification must be configured before opening this offer.'; END IF;
  SELECT count(*) INTO v_claimed FROM public.wallet_bank_bonus_claims;
  IF p_claim_limit < v_claimed THEN RAISE EXCEPTION 'The limit cannot be lower than the number already credited.'; END IF;
  IF p_enabled AND p_claim_limit = v_claimed THEN RAISE EXCEPTION 'Increase the account limit to restart the offer.'; END IF;

  UPDATE public.wallet_bank_bonus_settings SET enabled = p_enabled, amount = p_amount, claim_limit = p_claim_limit
    WHERE singleton;
  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, summary, metadata)
    VALUES (auth.uid(), 'wallet_bank_bonus_updated', 'system', 'Updated the personal bank account bonus',
      jsonb_build_object('enabled', p_enabled, 'amount', p_amount, 'claim_limit', p_claim_limit));
  RETURN public.admin_wallet_bank_bonus_report();
END;
$$;

CREATE FUNCTION public.service_complete_wallet_bank_account(p_user_id uuid, p_bvn text, p_account jsonb, p_live boolean, p_verification_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_settings public.wallet_bank_bonus_settings%ROWTYPE;
  v_identity_key bytea;
  v_provider_account_key bytea;
  v_claimed bigint;
  v_transaction_id uuid;
  v_balance numeric;
  v_bonus numeric := 0;
BEGIN
  IF p_bvn IS NULL OR p_bvn !~ '^[0-9]{11}$'
    OR coalesce(p_account->>'accountNumber', '') !~ '^[0-9]{10}$'
    OR coalesce(p_account->>'bankName', '') = ''
    OR coalesce(nullif(p_account->>'flwRef', ''), nullif(p_account->>'orderRef', '')) IS NULL THEN
    RAISE EXCEPTION 'Invalid bank-account confirmation';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(v_profile.status, 'active') <> 'active' OR v_profile.bvn IS DISTINCT FROM p_bvn THEN
    RAISE EXCEPTION 'Bank-account setup no longer matches this profile';
  END IF;
  IF public.wallet_has_personal_bank_account(v_profile.preferences) THEN
    RETURN jsonb_build_object('account', v_profile.preferences->'virtualAccount', 'bonusAmount', 0);
  END IF;

  v_balance := coalesce(v_profile.wallet_balance, 0);
  IF p_live IS TRUE AND p_verification_id IS NOT NULL THEN
    -- Every award and settings update takes the same lock before counting claims.
    SELECT * INTO STRICT v_settings FROM public.wallet_bank_bonus_settings WHERE singleton FOR UPDATE;
    IF v_settings.enabled AND v_settings.verification_ready THEN
      SELECT count(*) INTO v_claimed FROM public.wallet_bank_bonus_claims;
      v_identity_key := extensions.hmac(convert_to(p_bvn, 'UTF8'), v_settings.identity_secret, 'sha256');
      v_provider_account_key := extensions.hmac(
        convert_to(lower(p_account->>'bankName') || ':' || (p_account->>'accountNumber'),'UTF8'), v_settings.identity_secret,'sha256');
      IF v_claimed < v_settings.claim_limit AND EXISTS (
        SELECT 1 FROM public.wallet_bank_bonus_verifications
        WHERE id = p_verification_id AND user_id = p_user_id AND identity_key = v_identity_key
          AND provider_reference IS NOT NULL AND confirmed_at IS NOT NULL AND started_at > now() - interval '30 minutes'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.wallet_bank_bonus_claims
        WHERE user_id = p_user_id OR identity_key = v_identity_key OR provider_account_key = v_provider_account_key
      ) THEN
        v_bonus := v_settings.amount;
        INSERT INTO public.transactions (
          user_id, type, amount, status, payment_method, reference_id, description, balance_before, balance_after, metadata
        ) VALUES (
          p_user_id, 'deposit', v_bonus, 'completed', 'wallet_bonus', 'WALLET_BONUS_' || p_user_id,
          'Bank account setup bonus', v_balance, v_balance + v_bonus, jsonb_build_object('source', 'wallet_bank_bonus')
        ) RETURNING id INTO v_transaction_id;

        INSERT INTO public.wallet_bank_bonus_claims (user_id, identity_key, provider_account_key, transaction_id, amount)
          VALUES (p_user_id, v_identity_key, v_provider_account_key, v_transaction_id, v_bonus);
        INSERT INTO public.notifications (user_id, type, title, message)
          VALUES (p_user_id, 'wallet_credit', 'Bank account bonus received',
            '₦' || to_char(v_bonus, 'FM9,999,999,999,990.00') || ' was added to your wallet.');
        IF v_claimed + 1 >= v_settings.claim_limit THEN
          UPDATE public.wallet_bank_bonus_settings SET enabled = false WHERE singleton;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.profiles
    SET preferences = coalesce(preferences, '{}'::jsonb) || jsonb_build_object('virtualAccount', p_account),
        wallet_balance = CASE WHEN v_bonus > 0 THEN v_balance + v_bonus ELSE wallet_balance END,
        updated_at = now()
    WHERE id = p_user_id;
  DELETE FROM public.wallet_bank_bonus_verifications WHERE user_id = p_user_id;
  DELETE FROM public.wallet_bank_account_requests WHERE user_id = p_user_id;
  RETURN jsonb_build_object('account', p_account, 'bonusAmount', v_bonus);
END;
$$;

CREATE FUNCTION public.guard_wallet_bonus_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF (TG_OP <> 'INSERT' AND OLD.payment_method = 'wallet_bonus')
      OR (TG_OP <> 'DELETE' AND NEW.payment_method = 'wallet_bonus') THEN
      RAISE EXCEPTION 'Wallet bonuses are managed by the payment service';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_wallet_bonus_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_bonus_ledger();

REVOKE ALL ON FUNCTION public.wallet_has_personal_bank_account(jsonb), public.guard_wallet_bonus_ledger(),
  public.get_wallet_bank_bonus_offer(), public.admin_wallet_bank_bonus_report(),
  public.admin_update_wallet_bank_bonus(boolean, numeric, integer),
  public.service_start_wallet_bonus_verification(uuid, text, uuid), public.service_claim_wallet_account_setup(uuid),
  public.service_confirm_wallet_bonus_verification(uuid, uuid, text, text),
  public.service_complete_wallet_bank_account(uuid, text, jsonb, boolean, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_wallet_bank_bonus_offer(), public.admin_wallet_bank_bonus_report(),
  public.admin_update_wallet_bank_bonus(boolean, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_start_wallet_bonus_verification(uuid, text, uuid),
  public.service_claim_wallet_account_setup(uuid), public.service_confirm_wallet_bonus_verification(uuid, uuid, text, text),
  public.service_complete_wallet_bank_account(uuid, text, jsonb, boolean, uuid) TO service_role;

COMMIT;
