-- ============================================================================
-- Migration: 20261122_group_images_bvn_removal_and_proxy.sql
-- Purpose:
--   1. Group cover photo support (`contribution_groups.cover_image_url`) +
--      Supabase Storage `group-covers` public bucket & RLS policies +
--      `create_group_with_fee_check` with optional `p_cover_image_url`.
--   2. Super Admin BVN unlink / removal (`admin_remove_user_bvn`) with audit
--      logging and user notification.
--   3. Static-IP Flutterwave Payout Relay fields on `platform_payment_settings`
--      (`static_ip_proxy_url`, `static_ip_proxy_secret`, `static_ip_address`,
--      `transfers_enabled`) + updated `admin_get_payment_settings` &
--      `admin_save_payment_settings` RPCs.
-- ============================================================================

-- 1. Group cover image column
ALTER TABLE public.contribution_groups
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 2. Public Storage bucket `group-covers` + RLS policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-covers',
  'group-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Public read group covers" ON storage.objects;
CREATE POLICY "Public read group covers"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'group-covers');

DROP POLICY IF EXISTS "Authenticated users upload own group covers" ON storage.objects;
CREATE POLICY "Authenticated users upload own group covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own group covers" ON storage.objects;
CREATE POLICY "Users update own group covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-covers'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Users delete own group covers" ON storage.objects;
CREATE POLICY "Users delete own group covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-covers'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- 3. Update create_group_with_fee_check to persist cover_image_url
DROP FUNCTION IF EXISTS public.create_group_with_fee_check(uuid, text, text, numeric, text, text, text, boolean, numeric, timestamptz, timestamptz, numeric);

CREATE OR REPLACE FUNCTION public.create_group_with_fee_check(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_target_amount numeric,
  p_category text,
  p_frequency text,
  p_privacy text DEFAULT 'public'::text,
  p_enable_voting_rights boolean DEFAULT true,
  p_contribution_amount numeric DEFAULT NULL::numeric,
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_voting_threshold numeric DEFAULT 60,
  p_cover_image_url text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_free_remaining integer;
  v_wallet_balance numeric;
  v_balance_after numeric;
  v_bvn text;
  v_status text;
  v_role text;
  v_recent_24h integer := 0;
  v_creation_fee numeric := 500;
  v_group_id uuid;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized user context');
  END IF;

  SELECT
    COALESCE(groups_created_free_remaining, 0),
    COALESCE(wallet_balance, 0),
    bvn,
    COALESCE(status, 'active'),
    COALESCE(role, 'user')
  INTO v_free_remaining, v_wallet_balance, v_bvn, v_status, v_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF v_status <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'ACCOUNT_RESTRICTED',
      'error', format('Your account is currently %s. Group creation is disabled.', v_status)
    );
  END IF;

  IF v_bvn IS NULL OR trim(v_bvn) !~ '^[0-9]{11}$' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'BVN_REQUIRED',
      'error', 'BVN verification is required before creating a group pool (AML/KYC policy).'
    );
  END IF;

  SELECT count(*) INTO v_recent_24h
  FROM public.contribution_groups
  WHERE creator_id = p_user_id
    AND created_at >= now() - interval '24 hours';

  IF v_role <> 'admin' AND v_recent_24h >= 3 THEN
    INSERT INTO public.aml_alerts (
      alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
    ) VALUES (
      'group_churn:' || p_user_id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
      p_user_id,
      'rapid_group_churn',
      'high',
      79,
      COALESCE(p_target_amount, 0),
      'Rapid Group Pool Creation Attempt',
      'User attempted to create more than 3 group pools within 24 hours (blocked by AML guard).',
      jsonb_build_object('recent_24h_count', v_recent_24h, 'attempted_name', p_name, 'target_amount', p_target_amount)
    ) ON CONFLICT (alert_key) DO NOTHING;

    RETURN json_build_object(
      'success', false,
      'code', 'GROUP_RATE_LIMIT',
      'error', 'Safety limit reached: you can create up to 3 group pools per 24 hours.'
    );
  END IF;

  IF v_free_remaining <= 0 THEN
    IF v_wallet_balance < v_creation_fee THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'message', format('You need ₦%s to create a group. Current balance: ₦%s', v_creation_fee, v_wallet_balance),
        'required_amount', v_creation_fee,
        'current_balance', v_wallet_balance
      );
    END IF;

    v_balance_after := v_wallet_balance - v_creation_fee;

    UPDATE public.profiles
    SET wallet_balance = v_balance_after,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.transactions (
      user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after
    ) VALUES (
      p_user_id, 'withdrawal', v_creation_fee,
      'Group creation fee for: ' || p_name, 'completed', 'wallet',
      'GROUP_FEE_' || replace(p_user_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
      v_wallet_balance, v_balance_after
    ) RETURNING id INTO v_transaction_id;
  END IF;

  INSERT INTO public.contribution_groups (
    name, description, target_amount, contribution_amount, category, frequency,
    start_date, end_date, creator_id, privacy, status, enable_voting_rights,
    voting_threshold, cover_image_url
  ) VALUES (
    p_name, p_description, p_target_amount, p_contribution_amount, p_category, p_frequency,
    COALESCE(p_start_date, now()), p_end_date, p_user_id, p_privacy, 'active',
    p_enable_voting_rights, p_voting_threshold, NULLIF(trim(COALESCE(p_cover_image_url, '')), '')
  ) RETURNING id INTO v_group_id;

  UPDATE public.profiles
  SET
    groups_created_count = COALESCE(groups_created_count, 0) + 1,
    groups_created_free_remaining = GREATEST(v_free_remaining - 1, 0),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'group_id', v_group_id,
    'fee_charged', CASE WHEN v_free_remaining > 0 THEN 0 ELSE v_creation_fee END,
    'free_remaining', GREATEST(v_free_remaining - 1, 0),
    'transaction_id', v_transaction_id,
    'message', CASE
      WHEN v_free_remaining > 0 THEN 'Group created successfully (free)'
      ELSE format('Group created successfully (₦%s charged)', v_creation_fee)
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_group_with_fee_check(uuid, text, text, numeric, text, text, text, boolean, numeric, timestamptz, timestamptz, numeric, text) TO authenticated;

-- 4. Super Admin RPC: Unlink / Remove BVN from a user account
CREATE OR REPLACE FUNCTION public.admin_remove_user_bvn(
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_user record;
  v_last4 text;
  v_note text := COALESCE(NULLIF(trim(p_reason), ''), 'BVN unlinked by Super Admin');
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT id, name, email, bvn INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.bvn IS NULL OR length(trim(v_user.bvn)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'This user does not have a linked BVN');
  END IF;

  v_last4 := right(trim(v_user.bvn), 4);

  UPDATE public.profiles
  SET bvn = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    v_admin_id,
    'remove_user_bvn',
    'user',
    p_user_id,
    format('Removed linked BVN (***%s) for %s', v_last4, COALESCE(v_user.name, v_user.email)),
    jsonb_build_object('removed_bvn_last4', v_last4, 'reason', v_note)
  );

  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (
    p_user_id,
    'kyc_update',
    'BVN Unlinked From Your Account',
    format('An administrator removed the BVN ending in %s from your profile (%s). You can link a new BVN in Security Settings.', v_last4, v_note),
    false
  );

  RETURN json_build_object(
    'success', true,
    'removed_bvn_last4', v_last4,
    'message', format('BVN ending in %s unlinked successfully', v_last4)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_user_bvn(uuid, text) TO authenticated;

-- 5. Static-IP Flutterwave Payout Relay columns & updated Admin Gateway RPCs
ALTER TABLE public.platform_payment_settings
  ADD COLUMN IF NOT EXISTS static_ip_proxy_url text,
  ADD COLUMN IF NOT EXISTS static_ip_proxy_secret text,
  ADD COLUMN IF NOT EXISTS static_ip_address text DEFAULT '2.25.15.1',
  ADD COLUMN IF NOT EXISTS transfers_enabled boolean NOT NULL DEFAULT true;

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
      'static_ip_proxy_url', COALESCE(v_row.static_ip_proxy_url, ''),
      'static_ip_address', COALESCE(v_row.static_ip_address, '2.25.15.1'),
      'has_proxy_secret', (v_row.static_ip_proxy_secret IS NOT NULL AND length(trim(v_row.static_ip_proxy_secret)) > 0),
      'proxy_secret_masked', public._mask_secret(v_row.static_ip_proxy_secret),
      'transfers_enabled', COALESCE(v_row.transfers_enabled, true),
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_save_payment_settings(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_save_payment_settings(
  p_mode text DEFAULT NULL,
  p_public_key text DEFAULT NULL,
  p_secret_key text DEFAULT NULL,
  p_encryption_key text DEFAULT NULL,
  p_webhook_hash text DEFAULT NULL,
  p_webhook_url text DEFAULT NULL,
  p_static_ip_proxy_url text DEFAULT NULL,
  p_static_ip_proxy_secret text DEFAULT NULL,
  p_static_ip_address text DEFAULT NULL,
  p_transfers_enabled boolean DEFAULT NULL
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
  IF p_static_ip_proxy_url IS NOT NULL AND trim(p_static_ip_proxy_url) <> COALESCE(v_existing.static_ip_proxy_url, '') THEN
    v_changed := array_append(v_changed, 'static_ip_proxy_url');
  END IF;
  IF p_static_ip_proxy_secret IS NOT NULL AND length(trim(p_static_ip_proxy_secret)) > 0 THEN
    v_changed := array_append(v_changed, 'static_ip_proxy_secret');
  END IF;
  IF p_transfers_enabled IS NOT NULL AND p_transfers_enabled <> COALESCE(v_existing.transfers_enabled, true) THEN
    v_changed := array_append(v_changed, 'transfers_enabled:' || p_transfers_enabled::text);
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
    static_ip_proxy_url = CASE
      WHEN p_static_ip_proxy_url IS NOT NULL THEN NULLIF(trim(p_static_ip_proxy_url), '')
      ELSE static_ip_proxy_url
    END,
    static_ip_proxy_secret = CASE
      WHEN p_static_ip_proxy_secret IS NOT NULL AND length(trim(p_static_ip_proxy_secret)) > 0 THEN trim(p_static_ip_proxy_secret)
      ELSE static_ip_proxy_secret
    END,
    static_ip_address = COALESCE(NULLIF(trim(p_static_ip_address), ''), static_ip_address),
    transfers_enabled = COALESCE(p_transfers_enabled, transfers_enabled, true),
    updated_by = v_admin_id,
    updated_at = now()
  WHERE id = 'default';

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    v_admin_id,
    'update_payment_settings',
    'system',
    NULL,
    format('Updated Flutterwave gateway & static-IP relay settings (%s mode)', upper(v_mode)),
    jsonb_build_object('mode', v_mode, 'updated_fields', to_jsonb(v_changed))
  );

  RETURN public.admin_get_payment_settings();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_payment_settings(text, text, text, text, text, text, text, text, text, boolean) TO authenticated;
