-- Super Admin Fintech Operations, Group Governance Controls, Penalties, AML Compliance & Audit Trail
-- Applied to CollectiPay (sivvjwffekhfabgxhbcd)

-- ============================================================================
-- 1. TABLES & INDEXES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.aml_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.contribution_groups(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (
    alert_type IN (
      'large_transaction',
      'structuring',
      'velocity_burst',
      'rapid_passthrough',
      'unverified_high_volume',
      'manual_flag'
    )
  ),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'dismissed')),
  risk_score integer NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  amount numeric DEFAULT 0,
  title text NOT NULL,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_note text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_status_severity ON public.aml_alerts (status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_user_id ON public.aml_alerts (user_id);

CREATE TABLE IF NOT EXISTS public.admin_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.contribution_groups(id) ON DELETE SET NULL,
  aml_alert_id uuid REFERENCES public.aml_alerts(id) ON DELETE SET NULL,
  penalty_type text NOT NULL CHECK (
    penalty_type IN (
      'late_contribution',
      'policy_violation',
      'aml_hold',
      'fraud_chargeback',
      'dispute_fine'
    )
  ),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'waived', 'pending')),
  deducted_from_wallet boolean NOT NULL DEFAULT false,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  waived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  waived_at timestamptz,
  waive_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_penalties_user_id ON public.admin_penalties (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_penalties_status ON public.admin_penalties (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('user', 'group', 'aml_alert', 'penalty', 'transaction', 'system')),
  target_id text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.aml_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage AML alerts" ON public.aml_alerts;
CREATE POLICY "Admins manage AML alerts"
  ON public.aml_alerts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage penalties" ON public.admin_penalties;
CREATE POLICY "Admins manage penalties"
  ON public.admin_penalties
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users read own penalties" ON public.admin_penalties;
CREATE POLICY "Users read own penalties"
  ON public.admin_penalties
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read and write audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins read and write audit logs"
  ON public.admin_audit_logs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. ADMIN WALLET & USER STATUS RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_deposit_to_user(
  p_target_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'Admin wallet credit'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_tx_id uuid;
  v_user_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT COALESCE(wallet_balance, 0), COALESCE(name, email)
  INTO v_balance_before, v_user_name
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  v_balance_after := v_balance_before + p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_balance_after,
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.transactions (
    user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_target_user_id, 'deposit', p_amount, COALESCE(NULLIF(trim(p_description), ''), 'Admin wallet credit'),
    'completed', 'admin',
    'ADMIN_DEP_' || replace(p_target_user_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
    v_balance_before, v_balance_after,
    jsonb_build_object('credited_by', auth.uid(), 'category', 'admin_credit')
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (
    p_target_user_id,
    'deposit',
    'Wallet Credited',
    format('NGN %s has been credited to your CollectiPay wallet by an administrator.', to_char(p_amount, 'FM999,999,999,990.00')),
    false
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'wallet_credit',
    'user',
    p_target_user_id::text,
    format('Credited NGN %s to %s', to_char(p_amount, 'FM999,999,999,990.00'), v_user_name),
    jsonb_build_object('amount', p_amount, 'description', p_description, 'transaction_id', v_tx_id, 'balance_before', v_balance_before, 'balance_after', v_balance_after)
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_user_wallet(
  p_target_user_id uuid,
  p_amount numeric,
  p_direction text,
  p_reason text DEFAULT 'Admin wallet adjustment'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_tx_id uuid;
  v_user_name text;
  v_reason text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_direction NOT IN ('credit', 'debit') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid adjustment direction');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'Admin wallet adjustment');

  IF p_direction = 'credit' THEN
    RETURN public.admin_deposit_to_user(p_target_user_id, p_amount, v_reason);
  END IF;

  SELECT COALESCE(wallet_balance, 0), COALESCE(name, email)
  INTO v_balance_before, v_user_name
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  IF v_balance_before < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance for debit');
  END IF;

  v_balance_after := v_balance_before - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_balance_after,
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.transactions (
    user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_target_user_id, 'payment', p_amount, v_reason,
    'completed', 'admin_debit',
    'ADMIN_DEB_' || replace(p_target_user_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
    v_balance_before, v_balance_after,
    jsonb_build_object('debited_by', auth.uid(), 'category', 'admin_debit', 'reason', v_reason)
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (
    p_target_user_id,
    'withdrawal',
    'Wallet Adjustment',
    format('NGN %s was debited from your wallet. Reason: %s', to_char(p_amount, 'FM999,999,999,990.00'), v_reason),
    false
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'wallet_debit',
    'user',
    p_target_user_id::text,
    format('Debited NGN %s from %s (%s)', to_char(p_amount, 'FM999,999,999,990.00'), v_user_name, v_reason),
    jsonb_build_object('amount', p_amount, 'reason', v_reason, 'transaction_id', v_tx_id, 'balance_before', v_balance_before, 'balance_after', v_balance_after)
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_name text;
  v_prev_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_status NOT IN ('active', 'paused', 'frozen', 'suspended') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid user status');
  END IF;

  SELECT COALESCE(name, email), status
  INTO v_user_name, v_prev_status
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE public.profiles
  SET status = p_status,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (
    p_user_id,
    'security_alert',
    CASE
      WHEN p_status = 'active' THEN 'Account Reactivated'
      WHEN p_status = 'frozen' THEN 'Account Frozen for Review'
      ELSE 'Account Status Updated'
    END,
    CASE
      WHEN p_status = 'active' THEN 'Your CollectiPay account is now active and all wallet features are restored.'
      ELSE format('Your account status has been set to %s.%s', p_status, CASE WHEN NULLIF(trim(COALESCE(p_reason, '')), '') IS NOT NULL THEN ' Reason: ' || trim(p_reason) ELSE '' END)
    END,
    false
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'user_status_' || p_status,
    'user',
    p_user_id::text,
    format('Set %s status from %s to %s', v_user_name, COALESCE(v_prev_status, 'active'), p_status),
    jsonb_build_object('previous_status', v_prev_status, 'new_status', p_status, 'reason', p_reason)
  );

  RETURN json_build_object('success', true, 'status', p_status);
END;
$$;

-- ============================================================================
-- 4. ADMIN GROUP OPERATIONS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_group_status(
  p_group_id uuid,
  p_status text DEFAULT NULL,
  p_archived boolean DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_next_status text;
  v_next_archived boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'paused', 'frozen', 'completed', 'cancelled') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid group status');
  END IF;

  SELECT id, name, creator_id, status, archived
  INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  v_next_status := COALESCE(p_status, v_group.status, 'active');
  v_next_archived := COALESCE(p_archived, v_group.archived, false);

  UPDATE public.contribution_groups
  SET status = v_next_status,
      archived = v_next_archived,
      archived_at = CASE WHEN v_next_archived THEN COALESCE(archived_at, now()) ELSE NULL END,
      archived_by = CASE WHEN v_next_archived THEN auth.uid() ELSE NULL END,
      updated_at = now()
  WHERE id = p_group_id;

  IF v_group.creator_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
    VALUES (
      v_group.creator_id,
      'group_update',
      format('Group "%s" Updated by Admin', v_group.name),
      format('Status is now %s%s.%s',
        v_next_status,
        CASE WHEN v_next_archived THEN ' (archived)' ELSE '' END,
        CASE WHEN NULLIF(trim(COALESCE(p_reason, '')), '') IS NOT NULL THEN ' Note: ' || trim(p_reason) ELSE '' END
      ),
      p_group_id,
      false
    );
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'group_status_update',
    'group',
    p_group_id::text,
    format('Updated group "%s" to status=%s, archived=%s', v_group.name, v_next_status, v_next_archived),
    jsonb_build_object(
      'group_name', v_group.name,
      'previous_status', v_group.status,
      'new_status', v_next_status,
      'previous_archived', v_group.archived,
      'new_archived', v_next_archived,
      'reason', p_reason
    )
  );

  RETURN json_build_object('success', true, 'status', v_next_status, 'archived', v_next_archived);
END;
$$;

-- ============================================================================
-- 5. PENALTY MANAGEMENT RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_issue_penalty(
  p_user_id uuid,
  p_amount numeric,
  p_penalty_type text,
  p_reason text,
  p_deduct_wallet boolean DEFAULT true,
  p_group_id uuid DEFAULT NULL,
  p_aml_alert_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  v_user_name text;
  v_did_deduct boolean := false;
  v_tx_id uuid := NULL;
  v_penalty_id uuid;
  v_status text := 'applied';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Penalty amount must be greater than zero');
  END IF;

  IF p_penalty_type NOT IN ('late_contribution', 'policy_violation', 'aml_hold', 'fraud_chargeback', 'dispute_fine') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid penalty type');
  END IF;

  IF trim(COALESCE(p_reason, '')) = '' THEN
    RETURN json_build_object('success', false, 'error', 'A reason is required when issuing a penalty');
  END IF;

  SELECT COALESCE(wallet_balance, 0), COALESCE(name, email)
  INTO v_balance_before, v_user_name
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_deduct_wallet THEN
    IF v_balance_before >= p_amount THEN
      v_balance_after := v_balance_before - p_amount;
      UPDATE public.profiles
      SET wallet_balance = v_balance_after,
          updated_at = now()
      WHERE id = p_user_id;

      INSERT INTO public.transactions (
        user_id, contribution_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after, metadata
      ) VALUES (
        p_user_id, p_group_id, 'payment',
        'Compliance Penalty: ' || trim(p_reason),
        'completed', 'admin_penalty',
        'PENALTY_' || replace(p_user_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
        v_balance_before, v_balance_after,
        jsonb_build_object('category', 'admin_penalty', 'penalty_type', p_penalty_type, 'issued_by', auth.uid(), 'aml_alert_id', p_aml_alert_id)
      ) RETURNING id INTO v_tx_id;

      v_did_deduct := true;
      v_status := 'applied';
    ELSE
      v_did_deduct := false;
      v_status := 'pending';
    END IF;
  ELSE
    v_did_deduct := false;
    v_status := 'pending';
  END IF;

  INSERT INTO public.admin_penalties (
    user_id, group_id, aml_alert_id, penalty_type, amount, reason, status, deducted_from_wallet, transaction_id, issued_by
  ) VALUES (
    p_user_id, p_group_id, p_aml_alert_id, p_penalty_type, p_amount, trim(p_reason), v_status, v_did_deduct, v_tx_id, auth.uid()
  ) RETURNING id INTO v_penalty_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_user_id,
    'penalty',
    'Compliance Penalty Issued',
    format('A penalty of NGN %s (%s) was issued: %s.%s',
      to_char(p_amount, 'FM999,999,999,990.00'),
      replace(p_penalty_type, '_', ' '),
      trim(p_reason),
      CASE WHEN v_did_deduct THEN ' Deducted from your wallet.' ELSE ' Status: pending settlement.' END
    ),
    p_group_id,
    false
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'issue_penalty',
    'penalty',
    v_penalty_id::text,
    format('Issued NGN %s %s penalty to %s (%s)', to_char(p_amount, 'FM999,999,999,990.00'), p_penalty_type, v_user_name, v_status),
    jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'penalty_type', p_penalty_type, 'reason', trim(p_reason), 'deducted_from_wallet', v_did_deduct, 'transaction_id', v_tx_id)
  );

  RETURN json_build_object(
    'success', true,
    'penalty_id', v_penalty_id,
    'status', v_status,
    'deducted_from_wallet', v_did_deduct,
    'transaction_id', v_tx_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_waive_penalty(
  p_penalty_id uuid,
  p_refund_wallet boolean DEFAULT true,
  p_note text DEFAULT 'Waived by administrator'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_penalty record;
  v_balance_before numeric;
  v_balance_after numeric;
  v_refund_tx_id uuid := NULL;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_penalty
  FROM public.admin_penalties
  WHERE id = p_penalty_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Penalty not found');
  END IF;

  IF v_penalty.status = 'waived' THEN
    RETURN json_build_object('success', false, 'error', 'Penalty is already waived');
  END IF;

  UPDATE public.admin_penalties
  SET status = 'waived',
      waived_by = auth.uid(),
      waived_at = now(),
      waive_note = COALESCE(NULLIF(trim(p_note), ''), 'Waived by administrator')
  WHERE id = p_penalty_id;

  IF p_refund_wallet AND v_penalty.deducted_from_wallet THEN
    SELECT COALESCE(wallet_balance, 0) INTO v_balance_before
    FROM public.profiles
    WHERE id = v_penalty.user_id
    FOR UPDATE;

    v_balance_after := v_balance_before + v_penalty.amount;

    UPDATE public.profiles
    SET wallet_balance = v_balance_after,
        updated_at = now()
    WHERE id = v_penalty.user_id;

    INSERT INTO public.transactions (
      user_id, contribution_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after, metadata
    ) VALUES (
      v_penalty.user_id, v_penalty.group_id, 'refund', v_penalty.amount,
      'Penalty Waiver Refund: ' || COALESCE(NULLIF(trim(p_note), ''), v_penalty.reason),
      'completed', 'admin_penalty_waiver',
      'WAIVE_' || replace(v_penalty.id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
      v_balance_before, v_balance_after,
      jsonb_build_object('category', 'penalty_waiver_refund', 'penalty_id', p_penalty_id, 'waived_by', auth.uid())
    ) RETURNING id INTO v_refund_tx_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, is_read)
  VALUES (
    v_penalty.user_id,
    'refund',
    'Penalty Waived',
    format('Your NGN %s compliance penalty has been waived.%s',
      to_char(v_penalty.amount, 'FM999,999,999,990.00'),
      CASE WHEN v_refund_tx_id IS NOT NULL THEN ' The amount has been refunded to your wallet.' ELSE '' END
    ),
    false
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'waive_penalty',
    'penalty',
    p_penalty_id::text,
    format('Waived penalty %s (NGN %s)%s', p_penalty_id, to_char(v_penalty.amount, 'FM999,999,999,990.00'), CASE WHEN v_refund_tx_id IS NOT NULL THEN ' with wallet refund' ELSE '' END),
    jsonb_build_object('user_id', v_penalty.user_id, 'amount', v_penalty.amount, 'refund_tx_id', v_refund_tx_id, 'note', p_note)
  );

  RETURN json_build_object('success', true, 'refunded', v_refund_tx_id IS NOT NULL, 'refund_tx_id', v_refund_tx_id);
END;
$$;

-- ============================================================================
-- 6. AML MONITORING & ALERT ENGINE RPCS
-- ============================================================================

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
    SELECT
      t.user_id,
      date_trunc('day', t.created_at) AS tx_day,
      count(*) AS tx_count,
      sum(t.amount) AS total_amt
    FROM public.transactions t
    WHERE t.user_id IS NOT NULL
      AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND t.amount < 500000
      AND t.amount >= 50000
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
    SELECT
      t.user_id,
      date_trunc('hour', t.created_at) AS tx_hour,
      count(*) AS tx_count,
      sum(t.amount) AS total_amt
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

  -- Rule 4: Rapid Pass-Through / Layering (Deposit >= 100k followed by >= 80% withdrawal/transfer within 2 hours)
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

  -- Rule 5: High Volume Without BVN Verification (30-day volume >= NGN 250,000, missing BVN)
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

  SELECT count(*) INTO v_open_count
  FROM public.aml_alerts
  WHERE status IN ('open', 'investigating', 'escalated');

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'aml_scan',
    'system',
    'aml_engine',
    format('Ran AML compliance scan: %s new alert(s), %s active alert(s)', v_inserted, v_open_count),
    jsonb_build_object('new_alerts', v_inserted, 'active_alerts', v_open_count)
  );

  RETURN json_build_object('success', true, 'new_alerts', v_inserted, 'active_alerts', v_open_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_aml_alert(
  p_alert_id uuid,
  p_status text,
  p_resolution_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alert record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_status NOT IN ('open', 'investigating', 'escalated', 'resolved', 'dismissed') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid AML alert status');
  END IF;

  SELECT * INTO v_alert
  FROM public.aml_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'AML alert not found');
  END IF;

  UPDATE public.aml_alerts
  SET status = p_status,
      resolution_note = COALESCE(NULLIF(trim(p_resolution_note), ''), resolution_note),
      resolved_by = CASE WHEN p_status IN ('resolved', 'dismissed') THEN auth.uid() ELSE resolved_by END,
      resolved_at = CASE WHEN p_status IN ('resolved', 'dismissed') THEN now() ELSE resolved_at END,
      updated_at = now()
  WHERE id = p_alert_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'aml_alert_' || p_status,
    'aml_alert',
    p_alert_id::text,
    format('Updated AML alert "%s" to %s', v_alert.title, p_status),
    jsonb_build_object('previous_status', v_alert.status, 'new_status', p_status, 'note', p_resolution_note, 'user_id', v_alert.user_id)
  );

  RETURN json_build_object('success', true, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_aml_alert(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_severity text DEFAULT 'high',
  p_risk_score integer DEFAULT 80,
  p_amount numeric DEFAULT 0,
  p_group_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid severity');
  END IF;

  INSERT INTO public.aml_alerts (
    alert_key, user_id, group_id, alert_type, severity, status, risk_score, amount, title, description, evidence
  ) VALUES (
    'manual:' || gen_random_uuid()::text,
    p_user_id,
    p_group_id,
    'manual_flag',
    p_severity,
    'open',
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 80))),
    COALESCE(p_amount, 0),
    trim(p_title),
    trim(p_description),
    jsonb_build_object('flagged_by', auth.uid(), 'manual', true)
  ) RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'aml_manual_flag',
    'aml_alert',
    v_id::text,
    format('Created manual %s AML flag: %s', p_severity, trim(p_title)),
    jsonb_build_object('user_id', p_user_id, 'group_id', p_group_id, 'severity', p_severity, 'amount', p_amount)
  );

  RETURN json_build_object('success', true, 'alert_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_deposit_to_user(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_wallet(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_group_status(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_penalty(uuid, numeric, text, text, boolean, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_waive_penalty(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_scan_aml_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_aml_alert(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_aml_alert(uuid, text, text, text, integer, numeric, uuid) TO authenticated;
