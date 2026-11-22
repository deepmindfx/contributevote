BEGIN;

CREATE TABLE public.wallet_pin_secret (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL DEFAULT extensions.gen_random_bytes(32)
);
INSERT INTO public.wallet_pin_secret DEFAULT VALUES;

CREATE TABLE public.wallet_pin_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

ALTER TABLE public.wallet_pin_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_pin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_pin_secret, public.wallet_pin_credentials FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.wallet_pin_digest(p_user_id uuid, p_pin text)
RETURNS text LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT encode(extensions.hmac(convert_to(p_user_id::text || ':' || p_pin, 'UTF8'), secret, 'sha256'), 'hex')
  FROM public.wallet_pin_secret WHERE singleton;
$$;

INSERT INTO public.wallet_pin_credentials (user_id, pin_hash)
SELECT id, extensions.crypt(public.wallet_pin_digest(id, preferences->>'transactionPin'), extensions.gen_salt('bf', 8))
FROM public.profiles WHERE preferences->>'transactionPin' ~ '^[0-9]{4}$';

UPDATE public.profiles
SET preferences = (preferences - 'transactionPin' - 'transactionPinSet') ||
  CASE WHEN EXISTS (SELECT 1 FROM public.wallet_pin_credentials c WHERE c.user_id = profiles.id)
    THEN '{"transactionPinSet":true}'::jsonb ELSE '{}'::jsonb END
WHERE preferences ? 'transactionPin' OR preferences ? 'transactionPinSet';

-- Profile writers may still update ordinary preferences and administrators may manage status.
-- Balances, identities and security preferences are owned by the corresponding server workflows.
CREATE FUNCTION public.guard_client_wallet_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_key text;
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() OR coalesce(NEW.wallet_balance, 0) <> 0
      OR lower(NEW.email) IS DISTINCT FROM lower(auth.jwt()->>'email')
      OR coalesce(NEW.role,'user') <> 'user' OR coalesce(NEW.status,'active') <> 'active' OR NEW.bvn IS NOT NULL
      OR coalesce(NEW.is_verified_organizer,false) OR NEW.organizer_badge_label IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid initial wallet profile';
    END IF;
  ELSIF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.bvn IS DISTINCT FROM OLD.bvn OR NEW.email IS DISTINCT FROM OLD.email
    OR (NEW.status IS DISTINCT FROM OLD.status AND NOT coalesce(public.is_admin(),false)) THEN
    RAISE EXCEPTION 'Only the server can update financial profile fields';
  END IF;

  NEW.preferences := coalesce(NEW.preferences, '{}'::jsonb);
  IF jsonb_typeof(NEW.preferences) <> 'object' THEN RAISE EXCEPTION 'Invalid profile preferences'; END IF;
  FOREACH v_key IN ARRAY ARRAY['transactionPin','transactionPinSet','virtualAccount','bvnVerifiedAt'] LOOP
    NEW.preferences := NEW.preferences - v_key;
    IF TG_OP = 'UPDATE' AND OLD.preferences ? v_key THEN
      NEW.preferences := NEW.preferences || jsonb_build_object(v_key, OLD.preferences->v_key);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_client_wallet_profile BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_client_wallet_profile();

-- All callers lock the wallet before checking a PIN. Returning failures keeps the lockout
-- counter committed, including when the client calls the final authorization RPC directly.
CREATE FUNCTION public.check_wallet_pin(p_user_id uuid, p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_credential public.wallet_pin_credentials%ROWTYPE;
  v_pin text := trim(coalesce(p_pin,''));
  v_failures integer;
BEGIN
  SELECT * INTO v_credential FROM public.wallet_pin_credentials WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'has_pin',false,'pin_required',true,'error','Set up your 4-digit Transaction PIN first.');
  END IF;
  IF v_credential.locked_until > now() THEN
    RETURN json_build_object('success',false,'has_pin',true,'error','Too many incorrect PIN attempts. Try again in 15 minutes.');
  END IF;
  IF v_pin !~ '^[0-9]{4}$' OR extensions.crypt(public.wallet_pin_digest(p_user_id,v_pin), v_credential.pin_hash) IS DISTINCT FROM v_credential.pin_hash THEN
    v_failures := CASE WHEN v_credential.locked_until IS NOT NULL THEN 1 ELSE v_credential.failures + 1 END;
    UPDATE public.wallet_pin_credentials
    SET failures = v_failures, locked_until = CASE WHEN v_failures >= 5 THEN now() + interval '15 minutes' END
    WHERE user_id = p_user_id;
    RETURN json_build_object('success',false,'has_pin',true,'pin_invalid',true,'error',
      CASE WHEN v_failures >= 5 THEN 'Too many incorrect PIN attempts. Try again in 15 minutes.' ELSE 'Incorrect 4-digit Transaction PIN.' END);
  END IF;
  IF v_credential.failures > 0 OR v_credential.locked_until IS NOT NULL THEN
    UPDATE public.wallet_pin_credentials SET failures = 0, locked_until = NULL WHERE user_id = p_user_id;
  END IF;
  RETURN json_build_object('success',true,'has_pin',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_transaction_pin(p_pin text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('success',false,'error','Sign in first.'); END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  RETURN public.check_wallet_pin(auth.uid(),p_pin);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_transaction_pin(p_new_pin text, p_current_pin text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pin text := trim(coalesce(p_new_pin,''));
  v_check json;
BEGIN
  IF v_user_id IS NULL THEN RETURN json_build_object('success',false,'error','Sign in first.'); END IF;
  IF v_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success',false,'error','Enter a 4-digit Transaction PIN.');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_user_id AND coalesce(status,'active') = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','An active wallet is required.'); END IF;

  IF EXISTS (SELECT 1 FROM public.wallet_pin_credentials WHERE user_id = v_user_id) THEN
    IF nullif(trim(p_current_pin),'') IS NULL THEN
      RETURN json_build_object('success',false,'error','Enter your current PIN to change it.');
    END IF;
    v_check := public.check_wallet_pin(v_user_id,p_current_pin);
    IF (v_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_check; END IF;
  END IF;

  INSERT INTO public.wallet_pin_credentials (user_id,pin_hash)
  VALUES (v_user_id,extensions.crypt(public.wallet_pin_digest(v_user_id,v_pin),extensions.gen_salt('bf',8)))
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = excluded.pin_hash, failures = 0, locked_until = NULL;
  UPDATE public.profiles SET preferences = (coalesce(preferences, '{}'::jsonb) - 'transactionPin') || '{"transactionPinSet":true}',
    updated_at = now() WHERE id = v_user_id;
  RETURN json_build_object('success',true);
END;
$$;

CREATE FUNCTION public.service_authorize_bank_transfer(
  p_user_id uuid, p_reference text, p_amount numeric, p_expected_fee numeric, p_metadata jsonb, p_pin text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_check json;
  v_review jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success',false,'error','Confirm your email address before sending money.');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_user_id AND coalesce(status,'active') = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Account cannot send money'); END IF;
  v_check := public.check_wallet_pin(p_user_id,p_pin);
  IF (v_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_check::jsonb; END IF;
  SELECT metadata INTO v_review FROM public.transactions
    WHERE user_id = p_user_id AND type = 'transfer' AND reference_id = p_reference AND metadata ? 'pricing_reserved';
  IF FOUND AND (v_review->>'beneficiary_name' IS DISTINCT FROM p_metadata->>'beneficiary_name'
    OR v_review->>'narration' IS DISTINCT FROM p_metadata->>'narration') THEN
    RETURN jsonb_build_object('success',false,'error','Review this transfer again.');
  END IF;
  RETURN public.service_reserve_priced_transfer(p_user_id,p_reference,p_amount,p_expected_fee,p_metadata);
END;
$$;

-- Settlement and expiry acquire locks in the same order as reservation.
CREATE OR REPLACE FUNCTION public.service_settle_priced_transfer(p_reference text, p_status text, p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_transfer public.transactions%ROWTYPE;
  v_fee numeric;
  v_refund numeric;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','completed','failed') THEN RAISE EXCEPTION 'Invalid transfer status'; END IF;
  SELECT user_id INTO v_owner FROM public.transactions WHERE type = 'transfer' AND reference_id = p_reference;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_owner FOR UPDATE;

  SELECT * INTO v_transfer FROM public.transactions
  WHERE type = 'transfer' AND user_id = v_owner AND reference_id = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  IF v_transfer.status IN ('completed','failed') THEN
    RETURN jsonb_build_object('found',true,'status',v_transfer.status);
  END IF;
  IF v_transfer.metadata->>'dispatch_guard' = 'true' AND NOT (v_transfer.metadata ? 'dispatched_at')
    AND p_details->>'reason' IS DISTINCT FROM 'never_dispatched' THEN
    RETURN jsonb_build_object('found',true,'status',v_transfer.status);
  END IF;

  v_fee := coalesce((v_transfer.metadata->>'fee')::numeric,0);
  IF p_status = 'failed' THEN
    v_refund := coalesce((v_transfer.metadata->>'total_debited')::numeric,v_transfer.amount + v_fee);
    UPDATE public.profiles SET wallet_balance = coalesce(wallet_balance,0) + v_refund, updated_at = now()
    WHERE id = v_owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer refund account not found'; END IF;
    INSERT INTO public.notifications (user_id,type,title,message,is_read)
      VALUES (v_owner,'transfer_failed','Transfer failed and refunded',format('₦%s was returned to your wallet.',v_refund),false);
  ELSIF p_status = 'completed' AND v_fee > 0 AND v_transfer.metadata ? 'pricing_reserved' THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount)
      VALUES (v_transfer.id,'bank_transfer',v_fee) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.transactions SET status = p_status,
    metadata = coalesce(metadata,'{}'::jsonb) || (coalesce(p_details,'{}'::jsonb)
      - ARRAY['pricing_reserved','total_debited','fee','fee_reason','dispatch_guard','dispatched_at','account_number','account_bank','beneficiary_name','narration']),
    updated_at = now() WHERE id = v_transfer.id;
  RETURN jsonb_build_object('found',true,'status',p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_release_unsent_transfer(p_reference text, p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_transfer public.transactions%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  SELECT * INTO v_transfer FROM public.transactions
    WHERE reference_id = p_reference AND user_id = p_user_id AND type = 'transfer' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_transfer.status = 'pending' AND v_transfer.metadata->>'dispatch_guard' = 'true'
    AND NOT (v_transfer.metadata ? 'dispatched_at') AND v_transfer.created_at < now() - interval '2 minutes' THEN
    RETURN public.service_settle_priced_transfer(p_reference,'failed','{"reason":"never_dispatched"}') ->> 'status';
  END IF;
  RETURN v_transfer.status;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_pin_digest(uuid,text), public.check_wallet_pin(uuid,text),
  public.guard_client_wallet_profile(), public.service_authorize_bank_transfer(uuid,text,numeric,numeric,jsonb,text),
  public.service_reserve_priced_transfer(uuid,text,numeric,numeric,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_authorize_bank_transfer(uuid,text,numeric,numeric,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.service_settle_priced_transfer(text,text,jsonb),
  public.service_release_unsent_transfer(text,uuid),
  public.service_claim_transfer_dispatch(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_settle_priced_transfer(text,text,jsonb),
  public.service_release_unsent_transfer(text,uuid),
  public.service_claim_transfer_dispatch(text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.verify_user_transaction_pin(text), public.set_user_transaction_pin(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_user_transaction_pin(text), public.set_user_transaction_pin(text,text) TO authenticated;

-- Keep every existing interactive money flow on the same private PIN and lockout.

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_safe(
  p_group_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_requester record;
  v_pin_check json;
  v_group record;
  v_requester_name text;
  v_eligible_voters integer := 0;
  v_pending_total numeric := 0;
  v_available numeric := 0;
  v_request_id uuid;
  v_deadline timestamptz := now() + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT id, name, email, status, preferences INTO v_requester
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF COALESCE(v_requester.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', format('Your account is currently %s.', v_requester.status));
  END IF;

  v_pin_check := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin_check; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero');
  END IF;

  IF trim(COALESCE(p_purpose, '')) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Please explain the purpose of this withdrawal');
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF v_group.creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Only the group creator can request withdrawals');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Withdrawals are disabled while this group is %s.', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END)
    );
  END IF;

  IF v_group.enable_voting_rights = false THEN
    RETURN json_build_object('success', false, 'error', 'This group uses direct admin withdrawals rather than voting');
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_pending_total
  FROM public.withdrawal_requests
  WHERE contribution_id = p_group_id
    AND status = 'pending';

  v_available := COALESCE(v_group.current_amount, 0) - v_pending_total;

  IF p_amount > v_available THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Amount exceeds available unencumbered pool balance (₦%s).', to_char(GREATEST(v_available, 0), 'FM999,999,999,990.00'))
    );
  END IF;

  SELECT count(*) INTO v_eligible_voters
  FROM public.contributors
  WHERE group_id = p_group_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  IF v_eligible_voters = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'At least one contributor with verified voting rights is required before opening a withdrawal vote.'
    );
  END IF;

  v_requester_name := COALESCE(v_requester.name, v_requester.email, 'Group Admin');

  INSERT INTO public.withdrawal_requests (
    contribution_id, requester_id, amount, purpose, status, deadline, votes
  ) VALUES (
    p_group_id, v_uid, p_amount, trim(p_purpose), 'pending', v_deadline, '[]'::jsonb
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  SELECT
    c.user_id,
    'withdrawal_request',
    'New Withdrawal Vote Open',
    format('%s requested ₦%s from "%s". Cast your vote within 7 days.',
      v_requester_name,
      to_char(p_amount, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_request_id,
    false
  FROM public.contributors c
  WHERE c.group_id = p_group_id
    AND c.has_voting_rights = true
    AND c.user_id IS NOT NULL
    AND c.user_id <> v_uid;

  RETURN json_build_object(
    'success', true,
    'id', v_request_id,
    'deadline', v_deadline,
    'eligible_voters', v_eligible_voters
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contribute_from_wallet(
  p_user_id uuid,
  p_group_id uuid,
  p_amount numeric,
  p_anonymous boolean DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user record;
  v_group record;
  v_pin_check json;
  v_user_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_contributor_id uuid;
  v_ref text;
  v_anonymous boolean;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized contribution attempt');
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum contribution amount is ₦100');
  END IF;

  SELECT id, wallet_balance, status, name, preferences
  INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF COALESCE(v_user.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Your account is currently %s and cannot make contributions. Contact support.', v_user.status)
    );
  END IF;

  IF v_caller IS NOT NULL THEN
    v_pin_check := public.check_wallet_pin(p_user_id,p_pin);
    IF (v_pin_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin_check; END IF;
  END IF;

  v_anonymous := coalesce(p_anonymous,(v_user.preferences->>'anonymousContributions') = 'true',false);
  v_user_balance := COALESCE(v_user.wallet_balance, 0);
  IF v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', v_user_balance,
      'required', p_amount
    );
  END IF;

  SELECT id, name, status, archived, current_amount, enable_voting_rights
  INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true THEN
    RETURN json_build_object('success', false, 'error', 'This group has been archived and is no longer accepting contributions');
  END IF;

  IF COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('This group is currently %s and cannot receive contributions', v_group.status)
    );
  END IF;

  v_new_balance := v_user_balance - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.contributors (
    group_id,
    user_id,
    amount,
    total_contributed,
    contribution_count,
    has_voting_rights,
    join_method,
    anonymous,
    joined_at,
    last_contribution_at
  ) VALUES (
    p_group_id,
    p_user_id,
    p_amount,
    p_amount,
    1,
    true,
    'wallet',
    v_anonymous,
    now(),
    now()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = COALESCE(public.contributors.total_contributed, 0) + p_amount,
      contribution_count = COALESCE(public.contributors.contribution_count, 0) + 1,
      has_voting_rights = true,
      anonymous = coalesce(public.contributors.anonymous,false) OR EXCLUDED.anonymous,
      last_contribution_at = now(),
      updated_at = now()
  RETURNING id INTO v_contributor_id;

  v_ref := 'WALLET_' || substr(p_user_id::text, 1, 8) || '_' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO public.transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group.name || ' from wallet',
    'completed',
    'wallet',
    v_ref,
    v_anonymous,
    v_user_balance,
    v_new_balance,
    jsonb_build_object(
      'source', 'wallet',
      'instant_voting_rights', COALESCE(v_group.enable_voting_rights, true),
      'contributor_id', v_contributor_id,
      'pin_verified', (v_caller IS NOT NULL)
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'reference', v_ref,
    'contributor_id', v_contributor_id,
    'new_balance', v_new_balance,
    'voting_rights_granted', COALESCE(v_group.enable_voting_rights, true)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_instant_withdrawal(
  p_group_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_admin record;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(),current_user) <> 'service_role' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized withdrawal requester';
  END IF;

  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT id, wallet_balance, status, preferences INTO v_admin
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group.enable_voting_rights IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF v_group.creator_id <> p_admin_id THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Cannot withdraw while group is %', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END;
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  IF COALESCE(v_admin.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Your account is currently % and cannot withdraw funds', v_admin.status;
  END IF;

  v_admin_balance_before := COALESCE(v_admin.wallet_balance, 0);
  v_fee := (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric;
  v_net := p_amount - v_fee;
  v_admin_balance_after := v_admin_balance_before + v_net;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = p_admin_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_admin_id, p_group_id, 'withdrawal', v_net,
    'Instant withdrawal: ' || trim(COALESCE(p_purpose, '')), 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || replace(p_group_id::text, '-', '') || '_' || gen_random_uuid()::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting',
      'pin_verified', true, 'gross_amount', p_amount, 'fee', v_fee, 'net_amount', v_net
    )
  ) RETURNING id INTO v_transaction_id;
  IF v_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount) VALUES (v_transaction_id,'group_withdrawal',v_fee);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id,
    'wallet_credit',
    'Withdrawal Credited',
    format('₦%s withdrawn from "%s" and added to your wallet.', to_char(v_net, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

DROP FUNCTION public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric);

CREATE OR REPLACE FUNCTION public.process_priced_instant_withdrawal(
  p_group_id uuid, p_amount numeric, p_purpose text, p_pin text, p_expected_fee numeric
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_pin_check json;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  v_pin_check := public.check_wallet_pin(auth.uid(),p_pin);
  IF (v_pin_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin_check; END IF;
  PERFORM 1 FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric IS DISTINCT FROM p_expected_fee THEN
    RAISE EXCEPTION 'The withdrawal fee changed. Reopen the withdrawal to review the updated amount.';
  END IF;
  PERFORM public.process_instant_withdrawal(p_group_id,auth.uid(),p_amount,p_purpose,NULL);
  RETURN json_build_object('success',true);
END;
$$;

REVOKE ALL ON FUNCTION public.process_instant_withdrawal(uuid,uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_instant_withdrawal(uuid,uuid,numeric,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.create_withdrawal_request_safe(uuid,numeric,text,text),
  public.contribute_from_wallet(uuid,uuid,numeric,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request_safe(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contribute_from_wallet(uuid,uuid,numeric,boolean,text) TO authenticated, service_role;

COMMIT;
