-- AML Hardening: Mandatory BVN Gate for Group Creation, Anti-Sybil BVN Uniqueness,
-- External / Outside Payment Tracking & Expanded 7-Rule AML Engine

-- ============================================================================
-- 1. EXTERNAL / OUTSIDE PAYMENT TRACKER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.external_payment_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text UNIQUE,
  source_channel text NOT NULL CHECK (
    source_channel IN (
      'group_bank_transfer',
      'wallet_bank_transfer',
      'card_checkout',
      'share_link',
      'manual_claim'
    )
  ),
  group_id uuid REFERENCES public.contribution_groups(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN',
  sender_name text,
  sender_bank text,
  sender_account_masked text,
  sender_email text,
  destination_account text,
  narration text,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'verified', 'flagged', 'blocked')
  ),
  aml_risk_level text NOT NULL DEFAULT 'low' CHECK (
    aml_risk_level IN ('low', 'medium', 'high', 'critical')
  ),
  aml_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ext_pay_created ON public.external_payment_tracks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_pay_group ON public.external_payment_tracks (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_pay_risk ON public.external_payment_tracks (verification_status, aml_risk_level);

ALTER TABLE public.external_payment_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage external payment tracks" ON public.external_payment_tracks;
CREATE POLICY "Admins manage external payment tracks"
  ON public.external_payment_tracks
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Creators view external payments for their groups" ON public.external_payment_tracks;
CREATE POLICY "Creators view external payments for their groups"
  ON public.external_payment_tracks
  FOR SELECT
  TO authenticated
  USING (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.contribution_groups g
      WHERE g.id = group_id AND g.creator_id = auth.uid()
    )
  );

-- Expand AML alert types to cover external payment risks & shell-group churn
ALTER TABLE public.aml_alerts DROP CONSTRAINT IF EXISTS aml_alerts_alert_type_check;
ALTER TABLE public.aml_alerts ADD CONSTRAINT aml_alerts_alert_type_check CHECK (
  alert_type IN (
    'large_transaction',
    'structuring',
    'velocity_burst',
    'rapid_passthrough',
    'unverified_high_volume',
    'external_payment_risk',
    'rapid_group_churn',
    'manual_flag'
  )
);

-- Expand audit log target types to include external_payment
ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check;
ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_target_type_check CHECK (
  target_type IN ('user', 'group', 'aml_alert', 'penalty', 'transaction', 'external_payment', 'system')
);

-- Backfill existing historical external bank_transfer / card payments into external_payment_tracks
INSERT INTO public.external_payment_tracks (
  reference_id, source_channel, group_id, user_id, transaction_id, amount,
  sender_name, sender_bank, sender_email, destination_account, narration,
  verification_status, aml_risk_level, aml_flags, raw_metadata, created_at
)
SELECT
  COALESCE(t.reference_id, 'TX_' || t.id::text),
  CASE
    WHEN t.contribution_id IS NOT NULL AND t.payment_method = 'bank_transfer' THEN 'group_bank_transfer'
    WHEN t.payment_method = 'bank_transfer' THEN 'wallet_bank_transfer'
    ELSE 'card_checkout'
  END,
  t.contribution_id,
  t.user_id,
  t.id,
  t.amount,
  COALESCE(t.metadata->>'senderName', t.metadata->>'originatorName', t.metadata->>'customerName'),
  COALESCE(t.metadata->>'senderBank', t.metadata->>'bankName'),
  t.metadata->>'customerEmail',
  t.metadata->>'accountNumber',
  COALESCE(t.metadata->>'narration', t.description),
  CASE
    WHEN (t.metadata->>'requiresVerification')::boolean IS TRUE THEN 'unverified'
    ELSE 'verified'
  END,
  CASE
    WHEN t.amount >= 1000000 THEN 'critical'
    WHEN t.amount >= 500000 THEN 'high'
    WHEN t.amount >= 250000 THEN 'medium'
    ELSE 'low'
  END,
  CASE
    WHEN t.amount >= 500000 THEN '["high_value_external"]'::jsonb
    WHEN (t.metadata->>'requiresVerification')::boolean IS TRUE THEN '["unlinked_external_sender"]'::jsonb
    ELSE '[]'::jsonb
  END,
  COALESCE(t.metadata, '{}'::jsonb),
  t.created_at
FROM public.transactions t
WHERE t.amount > 0
  AND t.payment_method IN ('bank_transfer', 'card', 'flutterwave', 'banktransfer', 'ussd')
ON CONFLICT (reference_id) DO NOTHING;

-- ============================================================================
-- 2. MANDATORY BVN VERIFICATION RPC (ANTI-SYBIL / ANTI-MULE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_user_bvn(p_bvn text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text := regexp_replace(COALESCE(p_bvn, ''), '[^0-9]', '', 'g');
  v_duplicate_exists boolean;
  v_prefs jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF length(v_clean) <> 11 THEN
    RETURN json_build_object('success', false, 'error', 'BVN must be exactly 11 numeric digits');
  END IF;

  -- Anti-sybil / anti-mule guard: prevent one BVN from opening multiple shell identities
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE bvn = v_clean AND id <> v_uid
  ) INTO v_duplicate_exists;

  IF v_duplicate_exists THEN
    INSERT INTO public.aml_alerts (
      alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
    ) VALUES (
      'dup_bvn:' || v_uid::text || ':' || right(v_clean, 4),
      v_uid,
      'manual_flag',
      'critical',
      94,
      0,
      'Duplicate BVN Identity Attempt Blocked',
      'User attempted to register a BVN already linked to another CollectiPay account.',
      jsonb_build_object('rule', 'duplicate_bvn_blocked', 'bvn_last4', right(v_clean, 4))
    ) ON CONFLICT (alert_key) DO NOTHING;

    RETURN json_build_object(
      'success', false,
      'code', 'BVN_IN_USE',
      'error', 'This BVN is already linked to another CollectiPay account. Contact support if you need help.'
    );
  END IF;

  SELECT COALESCE(preferences, '{}'::jsonb) INTO v_prefs
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  UPDATE public.profiles
  SET bvn = v_clean,
      preferences = COALESCE(v_prefs, '{}'::jsonb) || jsonb_build_object('bvnVerifiedAt', now()),
      updated_at = now()
  WHERE id = v_uid;

  RETURN json_build_object(
    'success', true,
    'bvn_last4', right(v_clean, 4),
    'message', 'BVN saved and verified for group creation'
  );
END;
$$;

-- ============================================================================
-- 3. HARDENED GROUP CREATION ELIGIBILITY & BVN-GATED CREATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_group_creation_eligibility(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_free_remaining integer;
  v_total_created integer;
  v_bvn text;
  v_status text;
  v_bvn_verified boolean;
  v_account_active boolean;
  v_can_create_free boolean;
  v_creation_fee numeric := 500;
  v_recent_24h integer := 0;
BEGIN
  SELECT
    COALESCE(groups_created_free_remaining, 0),
    COALESCE(groups_created_count, 0),
    bvn,
    COALESCE(status, 'active')
  INTO v_free_remaining, v_total_created, v_bvn, v_status
  FROM public.profiles
  WHERE id = p_user_id;

  v_bvn_verified := v_bvn IS NOT NULL AND trim(v_bvn) ~ '^[0-9]{11}$';
  v_account_active := v_status = 'active';
  v_can_create_free := v_free_remaining > 0;

  SELECT count(*) INTO v_recent_24h
  FROM public.contribution_groups
  WHERE creator_id = p_user_id
    AND created_at >= now() - interval '24 hours';

  RETURN json_build_object(
    'bvn_verified', v_bvn_verified,
    'account_active', v_account_active,
    'account_status', v_status,
    'recent_24h_count', v_recent_24h,
    'can_create_group', v_bvn_verified AND v_account_active AND v_recent_24h < 3,
    'can_create_free', v_can_create_free,
    'free_remaining', v_free_remaining,
    'total_created', v_total_created,
    'creation_fee', CASE WHEN v_can_create_free THEN 0 ELSE v_creation_fee END,
    'message', CASE
      WHEN NOT v_account_active THEN format('Your account is currently %s and cannot create groups.', v_status)
      WHEN NOT v_bvn_verified THEN 'BVN verification is required before creating a group pool.'
      WHEN v_recent_24h >= 3 THEN 'Daily group creation safety limit reached (max 3 pools per 24 hours).'
      WHEN v_can_create_free THEN format('You have %s free group(s) remaining', v_free_remaining)
      ELSE format('Group creation fee: NGN %s (you have used all 3 free groups)', v_creation_fee)
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_with_fee_check(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_target_amount numeric,
  p_category text,
  p_frequency text,
  p_privacy text DEFAULT 'public',
  p_enable_voting_rights boolean DEFAULT true,
  p_contribution_amount numeric DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_voting_threshold numeric DEFAULT 60
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  -- AML Gate 1: Account must be active (not paused/frozen/suspended)
  IF v_status <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'ACCOUNT_RESTRICTED',
      'error', format('Your account is currently %s. Group creation is disabled.', v_status)
    );
  END IF;

  -- AML Gate 2: Mandatory 11-digit BVN KYC before creating any pool
  IF v_bvn IS NULL OR trim(v_bvn) !~ '^[0-9]{11}$' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'BVN_REQUIRED',
      'error', 'BVN verification is required before creating a group pool (AML/KYC policy).'
    );
  END IF;

  -- AML Gate 3: Anti-shell-group rate limit (max 3 new groups per 24h for non-admins)
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
      format('User attempted to create more than 3 group pools within 24 hours (blocked by AML guard).'),
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
        'message', format('You need NGN %s to create a group. Current balance: NGN %s', v_creation_fee, v_wallet_balance),
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
    start_date, end_date, creator_id, privacy, status, enable_voting_rights, voting_threshold
  ) VALUES (
    p_name, p_description, p_target_amount, p_contribution_amount, p_category, p_frequency,
    COALESCE(p_start_date, now()), p_end_date, p_user_id, p_privacy, 'active', p_enable_voting_rights, p_voting_threshold
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
      ELSE format('Group created successfully (NGN %s charged)', v_creation_fee)
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 4. ADMIN EXTERNAL PAYMENT REVIEW & UPGRADED 7-RULE AML SCANNER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_review_external_payment(
  p_track_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_track record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_status NOT IN ('unverified', 'verified', 'flagged', 'blocked') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid verification status');
  END IF;

  SELECT * INTO v_track
  FROM public.external_payment_tracks
  WHERE id = p_track_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'External payment record not found');
  END IF;

  UPDATE public.external_payment_tracks
  SET verification_status = p_status,
      aml_risk_level = CASE
        WHEN p_status = 'blocked' THEN 'critical'
        WHEN p_status = 'flagged' THEN 'high'
        WHEN p_status = 'verified' THEN 'low'
        ELSE aml_risk_level
      END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = COALESCE(NULLIF(trim(p_note), ''), review_note)
  WHERE id = p_track_id;

  IF p_status IN ('flagged', 'blocked') THEN
    INSERT INTO public.aml_alerts (
      alert_key, user_id, group_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
    ) VALUES (
      'ext_pay_flag:' || v_track.id::text,
      v_track.user_id,
      v_track.group_id,
      v_track.transaction_id,
      'external_payment_risk',
      CASE WHEN p_status = 'blocked' THEN 'critical' ELSE 'high' END,
      CASE WHEN p_status = 'blocked' THEN 94 ELSE 80 END,
      v_track.amount,
      format('External Payment %s: %s', upper(p_status), COALESCE(v_track.sender_name, 'Outside Sender')),
      format('Outside %s payment of NGN %s from %s (%s) was marked %s.%s',
        replace(v_track.source_channel, '_', ' '),
        to_char(v_track.amount, 'FM999,999,999,990.00'),
        COALESCE(v_track.sender_name, 'Unknown sender'),
        COALESCE(v_track.sender_bank, 'External bank'),
        p_status,
        CASE WHEN NULLIF(trim(COALESCE(p_note, '')), '') IS NOT NULL THEN ' Note: ' || trim(p_note) ELSE '' END
      ),
      jsonb_build_object('track_id', v_track.id, 'reference_id', v_track.reference_id, 'source_channel', v_track.source_channel)
    ) ON CONFLICT (alert_key) DO NOTHING;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'external_payment_' || p_status,
    'external_payment',
    p_track_id::text,
    format('Marked external payment %s (NGN %s) as %s', COALESCE(v_track.reference_id, p_track_id::text), to_char(v_track.amount, 'FM999,999,999,990.00'), p_status),
    jsonb_build_object('sender_name', v_track.sender_name, 'source_channel', v_track.source_channel, 'note', p_note)
  );

  RETURN json_build_object('success', true, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_scan_aml_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer := 0;
  v_row_count integer := 0;
  v_open_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Rule 1: Large single transaction (>= NGN 500,000 in last 90 days)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, group_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'large_tx:' || t.id::text,
    t.user_id,
    t.contribution_id,
    t.id,
    'large_transaction',
    CASE WHEN t.amount >= 2000000 THEN 'critical' ELSE 'high' END,
    CASE WHEN t.amount >= 2000000 THEN 92 ELSE 78 END,
    t.amount,
    CASE WHEN t.amount >= 2000000 THEN 'Critical High-Value Transaction' ELSE 'High-Value Transaction Threshold' END,
    format('Single %s transaction of NGN %s exceeded the NGN 500,000 AML monitoring threshold.',
      t.type, to_char(t.amount, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'single_tx_gte_500k', 'tx_type', t.type, 'reference_id', t.reference_id, 'created_at', t.created_at)
  FROM public.transactions t
  WHERE t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
    AND t.amount >= 500000
    AND t.created_at >= now() - interval '90 days'
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 2: Structuring / Smurfing (>= 3 sub-threshold txs on same UTC day totaling >= NGN 400,000)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'structuring:' || s.user_id::text || ':' || to_char(s.tx_day, 'YYYY-MM-DD'),
    s.user_id,
    'structuring',
    CASE WHEN s.total_amt >= 1000000 THEN 'critical' ELSE 'high' END,
    CASE WHEN s.total_amt >= 1000000 THEN 90 ELSE 82 END,
    s.total_amt,
    'Potential Structuring / Split Transfers',
    format('%s sub-threshold transactions totaling NGN %s detected on %s.',
      s.tx_count, to_char(s.total_amt, 'FM999,999,999,990.00'), to_char(s.tx_day, 'Mon DD, YYYY')
    ),
    jsonb_build_object('rule', 'structuring_daily_split', 'tx_count', s.tx_count, 'total_amount', s.total_amt, 'day', s.tx_day)
  FROM (
    SELECT t.user_id, date_trunc('day', t.created_at) AS tx_day, count(*) AS tx_count, sum(t.amount) AS total_amt
    FROM public.transactions t
    WHERE t.user_id IS NOT NULL
      AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND t.amount < 500000 AND t.amount >= 50000
      AND t.created_at >= now() - interval '30 days'
    GROUP BY t.user_id, date_trunc('day', t.created_at)
    HAVING count(*) >= 3 AND sum(t.amount) >= 400000
  ) s
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 3: Velocity Burst (>= 5 financial transactions within 1 hour)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'velocity:' || v.user_id::text || ':' || to_char(v.tx_hour, 'YYYYMMDDHH24'),
    v.user_id,
    'velocity_burst',
    'high',
    74,
    v.total_amt,
    'Unusual Transaction Velocity Burst',
    format('%s financial transactions (NGN %s total) occurred within a single hour.',
      v.tx_count, to_char(v.total_amt, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'velocity_5_per_hour', 'tx_count', v.tx_count, 'total_amount', v.total_amt, 'hour_bucket', v.tx_hour)
  FROM (
    SELECT t.user_id, date_trunc('hour', t.created_at) AS tx_hour, count(*) AS tx_count, sum(t.amount) AS total_amt
    FROM public.transactions t
    WHERE t.user_id IS NOT NULL
      AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND t.created_at >= now() - interval '30 days'
    GROUP BY t.user_id, date_trunc('hour', t.created_at)
    HAVING count(*) >= 5
  ) v
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 4: Rapid Pass-Through / Layering
  INSERT INTO public.aml_alerts (
    alert_key, user_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'passthrough:' || d.id::text,
    d.user_id,
    d.id,
    'rapid_passthrough',
    'critical',
    88,
    d.amount,
    'Rapid Deposit-to-Outflow Pass-Through',
    format('Deposit of NGN %s was followed by NGN %s in outbound transfers/withdrawals within 2 hours.',
      to_char(d.amount, 'FM999,999,999,990.00'), to_char(o.outflow, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'rapid_passthrough_2h', 'deposit_amount', d.amount, 'outflow_amount', o.outflow, 'deposit_time', d.created_at)
  FROM public.transactions d
  CROSS JOIN LATERAL (
    SELECT COALESCE(sum(t2.amount), 0) AS outflow
    FROM public.transactions t2
    WHERE t2.user_id = d.user_id
      AND t2.type IN ('withdrawal', 'transfer')
      AND t2.created_at >= d.created_at
      AND t2.created_at <= d.created_at + interval '2 hours'
  ) o
  WHERE d.type = 'deposit'
    AND d.amount >= 100000
    AND d.created_at >= now() - interval '30 days'
    AND o.outflow >= (d.amount * 0.8)
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 5: High Volume Without BVN Verification
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'unverified_vol:' || p.id::text || ':' || to_char(now(), 'YYYY-MM'),
    p.id,
    'unverified_high_volume',
    CASE WHEN u.vol >= 1000000 THEN 'high' ELSE 'medium' END,
    CASE WHEN u.vol >= 1000000 THEN 76 ELSE 62 END,
    u.vol,
    'Unverified KYC High Volume',
    format('Account transacted NGN %s over 30 days without verified BVN on file.',
      to_char(u.vol, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'missing_bvn_high_volume', 'volume_30d', u.vol, 'tx_count', u.tx_count)
  FROM public.profiles p
  JOIN (
    SELECT user_id, sum(amount) AS vol, count(*) AS tx_count
    FROM public.transactions
    WHERE user_id IS NOT NULL
      AND type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND created_at >= now() - interval '30 days'
    GROUP BY user_id
    HAVING sum(amount) >= 250000
  ) u ON u.user_id = p.id
  WHERE p.bvn IS NULL OR length(trim(p.bvn)) < 11
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 6: Unverified / High-Risk Outside Payments (>= NGN 250,000 unverified external bank/card transfer)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, group_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'ext_unverified:' || e.id::text,
    e.user_id,
    e.group_id,
    e.transaction_id,
    'external_payment_risk',
    CASE WHEN e.amount >= 500000 THEN 'critical' ELSE 'high' END,
    CASE WHEN e.amount >= 500000 THEN 89 ELSE 75 END,
    e.amount,
    'Unverified Outside Payment Above Threshold',
    format('External %s of NGN %s from %s (%s) requires source-of-funds verification.',
      replace(e.source_channel, '_', ' '),
      to_char(e.amount, 'FM999,999,999,990.00'),
      COALESCE(e.sender_name, 'Unidentified outside sender'),
      COALESCE(e.sender_bank, 'External bank')
    ),
    jsonb_build_object('rule', 'unverified_external_250k', 'track_id', e.id, 'reference_id', e.reference_id, 'sender_name', e.sender_name, 'sender_bank', e.sender_bank)
  FROM public.external_payment_tracks e
  WHERE e.verification_status IN ('unverified', 'flagged')
    AND e.amount >= 250000
    AND e.created_at >= now() - interval '60 days'
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 7: Rapid Group Churn (>= 4 groups created by same account within 7 days)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'group_churn_7d:' || c.creator_id::text || ':' || to_char(now(), 'IYYY-IW'),
    c.creator_id,
    'rapid_group_churn',
    'high',
    77,
    c.total_targets,
    'Unusual Multi-Group Creation Pattern',
    format('Account created %s contribution groups within 7 days (total target NGN %s).',
      c.grp_count, to_char(c.total_targets, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'rapid_group_creation_7d', 'group_count', c.grp_count, 'total_targets', c.total_targets)
  FROM (
    SELECT creator_id, count(*) AS grp_count, COALESCE(sum(target_amount), 0) AS total_targets
    FROM public.contribution_groups
    WHERE creator_id IS NOT NULL
      AND created_at >= now() - interval '7 days'
    GROUP BY creator_id
    HAVING count(*) >= 4
  ) c
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  SELECT count(*) INTO v_open_count
  FROM public.aml_alerts
  WHERE status IN ('open', 'investigating', 'escalated');

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'aml_scan',
    'system',
    'aml_engine',
    format('Ran 7-rule AML compliance scan: %s new alert(s), %s active alert(s)', v_inserted, v_open_count),
    jsonb_build_object('new_alerts', v_inserted, 'active_alerts', v_open_count)
  );

  RETURN json_build_object('success', true, 'new_alerts', v_inserted, 'active_alerts', v_open_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_user_bvn(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_group_creation_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_external_payment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_scan_aml_alerts() TO authenticated;
