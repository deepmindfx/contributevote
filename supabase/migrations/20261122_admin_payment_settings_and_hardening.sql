-- ============================================================================
-- Migration: 20261122_admin_payment_settings_and_hardening.sql
-- Purpose:
--   1. Platform Payment Settings table & admin RPCs (Flutterwave live/test
--      credentials, webhook URL, secret hash) managed inside Super Admin.
--   2. Safe admin username/email login resolver (resolve_admin_login_email).
--   3. Deep-dive security & financial hardening:
--      - contribute_from_wallet: enforce active user/group status, caller check,
--        min amount, row locks, search_path=''.
--      - process_group_refund: fix Naira mojibake, cap refunds to actual group
--        balance (pro-rata scaling), decrement contributors.total_contributed
--        to prevent double-refunds, block frozen groups, search_path=''.
--      - service_adjust_wallet_balance: atomic service_role-only wallet credit
--        helper so Edge Functions never lose concurrent deposits on rollback.
-- ============================================================================

-- 1. Platform Payment Settings (singleton row id = 'default')
CREATE TABLE IF NOT EXISTS public.platform_payment_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  provider text NOT NULL DEFAULT 'flutterwave',
  flutterwave_mode text NOT NULL DEFAULT 'live' CHECK (flutterwave_mode IN ('live', 'test')),
  flutterwave_public_key text,
  flutterwave_secret_key text,
  flutterwave_encryption_key text,
  flutterwave_webhook_hash text,
  webhook_url text NOT NULL DEFAULT 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_payment_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage platform payment settings" ON public.platform_payment_settings;
CREATE POLICY "Admins manage platform payment settings"
  ON public.platform_payment_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.platform_payment_settings FROM anon;
REVOKE ALL ON public.platform_payment_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_payment_settings TO authenticated;

-- 2. Secret masking helper (internal)
CREATE OR REPLACE FUNCTION public._mask_secret(p_val text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_clean text;
  v_len integer;
BEGIN
  IF p_val IS NULL OR length(trim(p_val)) = 0 THEN
    RETURN NULL;
  END IF;
  v_clean := trim(p_val);
  v_len := length(v_clean);
  IF v_len <= 6 THEN
    RETURN repeat('*', v_len);
  ELSIF v_len <= 14 THEN
    RETURN left(v_clean, 3) || '••••' || right(v_clean, 3);
  ELSE
    RETURN left(v_clean, 10) || '••••••' || right(v_clean, 4);
  END IF;
END;
$$;

-- 3. Admin RPC: Read payment settings (secrets masked, never raw)
CREATE OR REPLACE FUNCTION public.admin_get_payment_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.platform_payment_settings%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO public.platform_payment_settings (id)
  VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.platform_payment_settings
  WHERE id = 'default';

  RETURN json_build_object(
    'success', true,
    'data', json_build_object(
      'provider', v_row.provider,
      'flutterwave_mode', v_row.flutterwave_mode,
      'flutterwave_public_key', COALESCE(v_row.flutterwave_public_key, ''),
      'webhook_url', v_row.webhook_url,
      'has_secret_key', (v_row.flutterwave_secret_key IS NOT NULL AND length(trim(v_row.flutterwave_secret_key)) > 0),
      'secret_key_masked', public._mask_secret(v_row.flutterwave_secret_key),
      'has_encryption_key', (v_row.flutterwave_encryption_key IS NOT NULL AND length(trim(v_row.flutterwave_encryption_key)) > 0),
      'encryption_key_masked', public._mask_secret(v_row.flutterwave_encryption_key),
      'has_webhook_hash', (v_row.flutterwave_webhook_hash IS NOT NULL AND length(trim(v_row.flutterwave_webhook_hash)) > 0),
      'webhook_hash_masked', public._mask_secret(v_row.flutterwave_webhook_hash),
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payment_settings() TO authenticated;

-- 4. Admin RPC: Save payment settings (blank secrets keep existing values; audited safely)
CREATE OR REPLACE FUNCTION public.admin_save_payment_settings(
  p_mode text DEFAULT NULL,
  p_public_key text DEFAULT NULL,
  p_secret_key text DEFAULT NULL,
  p_encryption_key text DEFAULT NULL,
  p_webhook_hash text DEFAULT NULL,
  p_webhook_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_mode text;
  v_existing public.platform_payment_settings%ROWTYPE;
  v_changed text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO public.platform_payment_settings (id)
  VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_existing
  FROM public.platform_payment_settings
  WHERE id = 'default'
  FOR UPDATE;

  v_mode := COALESCE(NULLIF(lower(trim(p_mode)), ''), v_existing.flutterwave_mode, 'live');
  IF v_mode NOT IN ('live', 'test') THEN
    RETURN json_build_object('success', false, 'error', 'Mode must be "live" or "test"');
  END IF;

  IF p_mode IS NOT NULL AND v_mode <> v_existing.flutterwave_mode THEN
    v_changed := array_append(v_changed, 'mode:' || v_mode);
  END IF;
  IF p_public_key IS NOT NULL AND trim(p_public_key) <> COALESCE(v_existing.flutterwave_public_key, '') THEN
    v_changed := array_append(v_changed, 'public_key');
  END IF;
  IF p_secret_key IS NOT NULL AND length(trim(p_secret_key)) > 0 THEN
    v_changed := array_append(v_changed, 'secret_key');
  END IF;
  IF p_encryption_key IS NOT NULL AND length(trim(p_encryption_key)) > 0 THEN
    v_changed := array_append(v_changed, 'encryption_key');
  END IF;
  IF p_webhook_hash IS NOT NULL AND length(trim(p_webhook_hash)) > 0 THEN
    v_changed := array_append(v_changed, 'webhook_hash');
  END IF;
  IF p_webhook_url IS NOT NULL AND length(trim(p_webhook_url)) > 0 AND trim(p_webhook_url) <> v_existing.webhook_url THEN
    v_changed := array_append(v_changed, 'webhook_url');
  END IF;

  UPDATE public.platform_payment_settings
  SET
    flutterwave_mode = v_mode,
    flutterwave_public_key = CASE
      WHEN p_public_key IS NOT NULL THEN NULLIF(trim(p_public_key), '')
      ELSE flutterwave_public_key
    END,
    flutterwave_secret_key = CASE
      WHEN p_secret_key IS NOT NULL AND length(trim(p_secret_key)) > 0 THEN trim(p_secret_key)
      ELSE flutterwave_secret_key
    END,
    flutterwave_encryption_key = CASE
      WHEN p_encryption_key IS NOT NULL AND length(trim(p_encryption_key)) > 0 THEN trim(p_encryption_key)
      ELSE flutterwave_encryption_key
    END,
    flutterwave_webhook_hash = CASE
      WHEN p_webhook_hash IS NOT NULL AND length(trim(p_webhook_hash)) > 0 THEN trim(p_webhook_hash)
      ELSE flutterwave_webhook_hash
    END,
    webhook_url = COALESCE(NULLIF(trim(p_webhook_url), ''), webhook_url),
    updated_by = v_admin_id,
    updated_at = now()
  WHERE id = 'default';

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    v_admin_id,
    'update_payment_settings',
    'system',
    NULL,
    format('Updated Flutterwave gateway settings (%s mode)', upper(v_mode)),
    jsonb_build_object(
      'mode', v_mode,
      'updated_fields', to_jsonb(v_changed)
    )
  );

  RETURN public.admin_get_payment_settings();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_payment_settings(text, text, text, text, text, text) TO authenticated;

-- 5. Public RPC: Non-secret payment config for client-side Flutterwave checkout
CREATE OR REPLACE FUNCTION public.get_public_payment_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.platform_payment_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.platform_payment_settings
  WHERE id = 'default';

  RETURN json_build_object(
    'flutterwave_mode', COALESCE(v_row.flutterwave_mode, 'live'),
    'flutterwave_public_key', COALESCE(v_row.flutterwave_public_key, ''),
    'webhook_url', COALESCE(v_row.webhook_url, 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution'),
    'is_configured', (
      v_row.flutterwave_public_key IS NOT NULL AND length(trim(v_row.flutterwave_public_key)) > 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_config() TO anon, authenticated;

-- 6. Safe Admin Login Resolver: resolves admin username -> email for real Supabase Auth signIn
CREATE OR REPLACE FUNCTION public.resolve_admin_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ident text := lower(trim(COALESCE(p_identifier, '')));
  v_email text;
BEGIN
  IF v_ident = '' THEN
    RETURN NULL;
  END IF;

  SELECT p.email INTO v_email
  FROM public.profiles p
  WHERE p.role = 'admin'
    AND COALESCE(p.status, 'active') = 'active'
    AND (
      lower(COALESCE(p.email, '')) = v_ident
      OR lower(COALESCE(p.preferences->>'username', '')) = v_ident
    )
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_admin_login_email(text) TO anon, authenticated;

-- 7. Atomic service_role-only wallet balance adjuster for Edge Functions
CREATE OR REPLACE FUNCTION public.service_adjust_wallet_balance(
  p_user_id uuid,
  p_delta numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before numeric;
  v_after numeric;
BEGIN
  IF p_user_id IS NULL OR p_delta IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid parameters');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_after := v_before + p_delta;
  IF v_after < 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'balance_before', v_before
    );
  END IF;

  UPDATE public.profiles
  SET wallet_balance = v_after,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'balance_before', v_before,
    'balance_after', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_adjust_wallet_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_adjust_wallet_balance(uuid, numeric) TO service_role;

-- 8. Hardened contribute_from_wallet (enforces active user, active group, caller auth, min amount)
CREATE OR REPLACE FUNCTION public.contribute_from_wallet(
  p_user_id uuid,
  p_group_id uuid,
  p_amount numeric,
  p_anonymous boolean DEFAULT false
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
  v_user_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_contributor_id uuid;
  v_ref text;
BEGIN
  -- Enforce caller identity for authenticated requests (allow service_role cron where auth.uid() IS NULL)
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized contribution attempt');
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum contribution amount is ₦100');
  END IF;

  -- Lock user row to prevent race conditions
  SELECT id, wallet_balance, status, name
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

  v_user_balance := COALESCE(v_user.wallet_balance, 0);
  IF v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', v_user_balance,
      'required', p_amount
    );
  END IF;

  -- Lock group row and verify active & not archived
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
    COALESCE(p_anonymous, false),
    now(),
    now()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = COALESCE(public.contributors.total_contributed, 0) + p_amount,
      contribution_count = COALESCE(public.contributors.contribution_count, 0) + 1,
      has_voting_rights = true,
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
    COALESCE(p_anonymous, false),
    v_user_balance,
    v_new_balance,
    jsonb_build_object(
      'source', 'wallet',
      'instant_voting_rights', COALESCE(v_group.enable_voting_rights, true),
      'contributor_id', v_contributor_id
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

-- 9. Hardened process_group_refund (pro-rata cap to group balance, prevents double-refunds, fixes Naira symbol)
CREATE OR REPLACE FUNCTION public.process_group_refund(p_refund_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request record;
  v_group record;
  v_contributor record;
  v_pct numeric := 100;
  v_total_eligible numeric := 0;
  v_requested_total numeric := 0;
  v_available_pool numeric := 0;
  v_scale numeric := 1;
  v_refund_amount numeric;
  v_balance_before numeric;
  v_balance_after numeric;
  v_total_refunded numeric := 0;
  v_refunds_processed integer := 0;
  v_refunds_failed integer := 0;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_request
  FROM public.group_refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not found');
  END IF;

  IF v_request.status = 'executed' THEN
    RETURN json_build_object('success', true, 'message', 'Refund already executed', 'already_executed', true);
  END IF;

  IF v_request.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not approved');
  END IF;

  -- Lock group row and block refunds on frozen groups
  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_request.group_id
  FOR UPDATE;

  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contribution group not found');
  END IF;

  IF COALESCE(v_group.status, 'active') = 'frozen' THEN
    RETURN json_build_object('success', false, 'error', 'Group is frozen by compliance and refunds are temporarily locked');
  END IF;

  v_available_pool := GREATEST(COALESCE(v_group.current_amount, 0), 0);
  IF v_available_pool <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Group has no remaining balance available to refund');
  END IF;

  v_pct := CASE
    WHEN v_request.refund_type = 'full' THEN 100
    ELSE LEAST(GREATEST(COALESCE(v_request.partial_percentage, 100), 1), 100)
  END;

  SELECT COALESCE(SUM(c.total_contributed), 0)
  INTO v_total_eligible
  FROM public.contributors c
  WHERE c.group_id = v_request.group_id
    AND COALESCE(c.total_contributed, 0) > 0
    AND c.user_id IS NOT NULL;

  IF v_total_eligible <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No refundable contributor balances found');
  END IF;

  v_requested_total := ROUND((v_total_eligible * (v_pct / 100.0))::numeric, 2);
  -- Cap total payout to actual remaining group balance (pro-rata scaling if withdrawals happened previously)
  v_scale := CASE
    WHEN v_requested_total > v_available_pool THEN (v_available_pool / v_requested_total)
    ELSE 1
  END;

  FOR v_contributor IN
    SELECT c.*
    FROM public.contributors c
    WHERE c.group_id = v_request.group_id
      AND COALESCE(c.total_contributed, 0) > 0
      AND c.user_id IS NOT NULL
    FOR UPDATE
  LOOP
    BEGIN
      v_refund_amount := ROUND((v_contributor.total_contributed * (v_pct / 100.0) * v_scale)::numeric, 2);
      -- Clamp final rounding dust so cumulative refunds never exceed available pool
      IF (v_total_refunded + v_refund_amount) > v_available_pool THEN
        v_refund_amount := GREATEST(ROUND((v_available_pool - v_total_refunded)::numeric, 2), 0);
      END IF;

      IF v_refund_amount <= 0 THEN
        CONTINUE;
      END IF;

      SELECT COALESCE(wallet_balance, 0) INTO v_balance_before
      FROM public.profiles
      WHERE id = v_contributor.user_id
      FOR UPDATE;

      v_balance_after := v_balance_before + v_refund_amount;

      UPDATE public.profiles
      SET wallet_balance = v_balance_after,
          updated_at = now()
      WHERE id = v_contributor.user_id;

      -- Decrement contributor's refundable total_contributed so duplicate refunds cannot over-pay
      UPDATE public.contributors
      SET total_contributed = GREATEST(COALESCE(total_contributed, 0) - v_refund_amount, 0),
          updated_at = now()
      WHERE id = v_contributor.id;

      INSERT INTO public.transactions (
        user_id, contribution_id, type, amount, description, status,
        payment_method, reference_id, balance_before, balance_after, metadata
      ) VALUES (
        v_contributor.user_id, v_request.group_id, 'refund', v_refund_amount,
        'Group refund: ' || COALESCE(v_request.reason, 'Approved member refund'), 'completed', 'wallet',
        'REFUND_' || p_refund_request_id || '_' || v_contributor.user_id,
        v_balance_before, v_balance_after,
        jsonb_build_object(
          'refund_request_id', p_refund_request_id,
          'original_contribution', v_contributor.total_contributed,
          'refund_percentage', v_pct,
          'pro_rata_scale', round(v_scale, 4)
        )
      )
      RETURNING id INTO v_transaction_id;

      INSERT INTO public.refund_transactions (
        refund_request_id, user_id, group_id, original_contribution,
        refund_amount, refund_percentage, status, transaction_id, completed_at
      ) VALUES (
        p_refund_request_id, v_contributor.user_id, v_request.group_id,
        v_contributor.total_contributed, v_refund_amount,
        v_pct,
        'completed', v_transaction_id, now()
      );

      INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
      VALUES (
        v_contributor.user_id,
        'refund_completed',
        'Group Refund Credited',
        format('₦%s from "%s" has been refunded to your wallet.',
          to_char(v_refund_amount, 'FM999,999,999,990.00'),
          COALESCE(v_group.name, 'group pool')
        ),
        v_request.group_id,
        false
      );

      v_total_refunded := v_total_refunded + v_refund_amount;
      v_refunds_processed := v_refunds_processed + 1;

    EXCEPTION
      WHEN OTHERS THEN
        INSERT INTO public.refund_transactions (
          refund_request_id, user_id, group_id, original_contribution,
          refund_amount, status, failure_reason
        ) VALUES (
          p_refund_request_id, v_contributor.user_id, v_request.group_id,
          v_contributor.total_contributed, COALESCE(v_refund_amount, 0), 'failed', SQLERRM
        );
        v_refunds_failed := v_refunds_failed + 1;
    END;
  END LOOP;

  UPDATE public.contribution_groups
  SET current_amount = GREATEST(COALESCE(current_amount, 0) - v_total_refunded, 0),
      updated_at = now()
  WHERE id = v_request.group_id;

  UPDATE public.group_refund_requests
  SET status = 'executed',
      executed_at = now(),
      execution_details = jsonb_build_object(
        'total_refunded', v_total_refunded,
        'refunds_processed', v_refunds_processed,
        'refunds_failed', v_refunds_failed,
        'pro_rata_scale', round(v_scale, 4)
      ),
      updated_at = now()
  WHERE id = p_refund_request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Refund processed successfully',
    'total_refunded', v_total_refunded,
    'refunds_processed', v_refunds_processed,
    'refunds_failed', v_refunds_failed
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
