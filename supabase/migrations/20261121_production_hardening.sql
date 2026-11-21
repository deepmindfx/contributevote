-- ============================================================================
-- COLLECTIPAY PRODUCTION HARDENING MIGRATION (2026-11-21)
-- ============================================================================
-- Fixes schema/trigger/RLS/realtime bugs found during production audit:
--   1. Admin helper & RLS policies (without exposing cross-user BVN/balances)
--   2. Public discovery & invite preview support for anon visitors
--   3. Tightened RLS on contributors & transactions
--   4. Fixed refund auto-approval trigger (AFTER UPDATE + status='approved' first)
--   5. Enhanced create_group_with_fee_check to persist schedule & voting fields
--   6. Safe helper RPCs: get_invitation_by_token, lookup_user_id_by_email,
--      get_group_contributors_safe, admin_deposit_to_user
--   7. Added profiles, contribution_groups, notifications, withdrawal_requests
--      to supabase_realtime publication
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Admin helper function (avoids recursive RLS lookups on profiles)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- --------------------------------------------------------------------------
-- 2. Profiles RLS: keep BVN/wallet private to owner + admins
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- --------------------------------------------------------------------------
-- 3. Public group discovery for unauthenticated (anon) visitors
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view non-archived public groups" ON contribution_groups;
CREATE POLICY "Public can view non-archived public groups"
  ON contribution_groups FOR SELECT
  TO anon
  USING (privacy = 'public' AND COALESCE(archived, false) = false);

-- --------------------------------------------------------------------------
-- 4. Tighten contributors RLS (replace permissive USING (true) writes)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert contributors" ON contributors;
DROP POLICY IF EXISTS "Authenticated users can update contributors" ON contributors;
DROP POLICY IF EXISTS "Authenticated users can delete contributors" ON contributors;
DROP POLICY IF EXISTS "Public can view contributors of public groups" ON contributors;

CREATE POLICY "Public can view contributors of public groups"
  ON contributors FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups g
      WHERE g.id = contributors.group_id
        AND g.privacy = 'public'
        AND COALESCE(g.archived, false) = false
    )
  );

CREATE POLICY "Users and group creators can insert contributors"
  ON contributors FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contribution_groups g
      WHERE g.id = contributors.group_id
        AND g.creator_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "Group creators and owners can update contributors"
  ON contributors FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contribution_groups g
      WHERE g.id = contributors.group_id
        AND g.creator_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "Group creators and admins can delete contributors"
  ON contributors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups g
      WHERE g.id = contributors.group_id
        AND g.creator_id = auth.uid()
    )
    OR public.is_admin()
  );

-- --------------------------------------------------------------------------
-- 5. Tighten transactions RLS + allow group audit visibility + admin view
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Group members can view group contribution transactions" ON transactions;

CREATE POLICY "Users can create their own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Group members can view group contribution transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    contribution_id IS NOT NULL
    AND type IN ('contribution', 'withdrawal', 'refund')
    AND (
      EXISTS (
        SELECT 1 FROM contribution_groups g
        WHERE g.id = transactions.contribution_id
          AND g.creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM contributors c
        WHERE c.group_id = transactions.contribution_id
          AND c.user_id = auth.uid()
      )
    )
  );

-- Also allow group creators to view/update withdrawal_requests for their groups even before contributing
DROP POLICY IF EXISTS "Users can view withdrawal requests for their groups" ON withdrawal_requests;
CREATE POLICY "Users can view withdrawal requests for their groups"
  ON withdrawal_requests FOR SELECT
  TO authenticated
  USING (
    contribution_id IN (
      SELECT group_id FROM contributors WHERE user_id = auth.uid()
    )
    OR contribution_id IN (
      SELECT id FROM contribution_groups WHERE creator_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Contributors can view refund requests for their groups" ON group_refund_requests;
CREATE POLICY "Contributors can view refund requests for their groups"
  ON group_refund_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE id = group_refund_requests.group_id
        AND creator_id = auth.uid()
    )
    OR public.is_admin()
  );

-- --------------------------------------------------------------------------
-- 6. Fix process_group_refund() to track balances and notify contributors
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_group_refund(
  p_refund_request_id UUID
) RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_contributor RECORD;
  v_refund_amount NUMERIC;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_total_refunded NUMERIC := 0;
  v_refunds_processed INTEGER := 0;
  v_refunds_failed INTEGER := 0;
  v_transaction_id UUID;
BEGIN
  SELECT * INTO v_request
  FROM group_refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not found');
  END IF;

  IF v_request.status = 'executed' THEN
    RETURN json_build_object('success', true, 'message', 'Refund already executed', 'already_executed', true);
  END IF;

  IF v_request.status != 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not approved');
  END IF;

  FOR v_contributor IN
    SELECT c.*, p.wallet_balance
    FROM contributors c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.group_id = v_request.group_id
      AND c.total_contributed > 0
      AND c.user_id IS NOT NULL
  LOOP
    BEGIN
      IF v_request.refund_type = 'full' THEN
        v_refund_amount := v_contributor.total_contributed;
      ELSE
        v_refund_amount := ROUND((v_contributor.total_contributed * (v_request.partial_percentage / 100.0))::numeric, 2);
      END IF;

      SELECT COALESCE(wallet_balance, 0) INTO v_balance_before
      FROM profiles
      WHERE id = v_contributor.user_id
      FOR UPDATE;

      v_balance_after := v_balance_before + v_refund_amount;

      UPDATE profiles
      SET wallet_balance = v_balance_after,
          updated_at = NOW()
      WHERE id = v_contributor.user_id;

      INSERT INTO transactions (
        user_id, contribution_id, type, amount, description, status,
        payment_method, reference_id, balance_before, balance_after, metadata
      ) VALUES (
        v_contributor.user_id, v_request.group_id, 'refund', v_refund_amount,
        'Group refund: ' || v_request.reason, 'completed', 'wallet',
        'REFUND_' || p_refund_request_id || '_' || v_contributor.user_id,
        v_balance_before, v_balance_after,
        json_build_object(
          'refund_request_id', p_refund_request_id,
          'original_contribution', v_contributor.total_contributed,
          'refund_percentage', CASE
            WHEN v_request.refund_type = 'full' THEN 100
            ELSE v_request.partial_percentage
          END
        )
      )
      RETURNING id INTO v_transaction_id;

      INSERT INTO refund_transactions (
        refund_request_id, user_id, group_id, original_contribution,
        refund_amount, refund_percentage, status, transaction_id, completed_at
      ) VALUES (
        p_refund_request_id, v_contributor.user_id, v_request.group_id,
        v_contributor.total_contributed, v_refund_amount,
        CASE WHEN v_request.refund_type = 'full' THEN 100 ELSE v_request.partial_percentage END,
        'completed', v_transaction_id, NOW()
      );

      INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
      VALUES (
        v_contributor.user_id,
        'refund_completed',
        'Group Refund Credited',
        format('₦%s has been refunded to your wallet.', v_refund_amount),
        v_request.group_id,
        false
      );

      v_total_refunded := v_total_refunded + v_refund_amount;
      v_refunds_processed := v_refunds_processed + 1;

    EXCEPTION
      WHEN OTHERS THEN
        INSERT INTO refund_transactions (
          refund_request_id, user_id, group_id, original_contribution,
          refund_amount, status, failure_reason
        ) VALUES (
          p_refund_request_id, v_contributor.user_id, v_request.group_id,
          v_contributor.total_contributed, COALESCE(v_refund_amount, 0), 'failed', SQLERRM
        );
        v_refunds_failed := v_refunds_failed + 1;
    END;
  END LOOP;

  UPDATE contribution_groups
  SET current_amount = GREATEST(COALESCE(current_amount, 0) - v_total_refunded, 0),
      updated_at = NOW()
  WHERE id = v_request.group_id;

  UPDATE group_refund_requests
  SET status = 'executed',
      executed_at = NOW(),
      execution_details = json_build_object(
        'total_refunded', v_total_refunded,
        'refunds_processed', v_refunds_processed,
        'refunds_failed', v_refunds_failed
      ),
      updated_at = NOW()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 7. Fix refund auto-approval trigger (AFTER UPDATE + status='approved' first)
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_check_refund_approval ON group_refund_requests;

CREATE OR REPLACE FUNCTION check_and_process_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_votes_for INT;
  v_votes_against INT;
  v_total_votes INT;
  v_eligible_voters INT;
  v_participation_rate DECIMAL;
  v_approval_rate DECIMAL;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_votes_for := COALESCE(NEW.total_votes_for, 0);
  v_votes_against := COALESCE(NEW.total_votes_against, 0);
  v_total_votes := v_votes_for + v_votes_against;

  SELECT COUNT(*)
  INTO v_eligible_voters
  FROM contributors
  WHERE group_id = NEW.group_id
    AND has_voting_rights = true;

  IF v_eligible_voters = 0 THEN
    v_eligible_voters := COALESCE(NEW.total_eligible_voters, 0);
  END IF;

  v_participation_rate := CASE WHEN v_eligible_voters > 0 THEN (v_total_votes::DECIMAL / v_eligible_voters) * 100 ELSE 0 END;
  v_approval_rate := CASE WHEN v_total_votes > 0 THEN (v_votes_for::DECIMAL / v_total_votes) * 100 ELSE 0 END;

  IF v_approval_rate >= 60 AND v_participation_rate >= 70 THEN
    UPDATE group_refund_requests
    SET status = 'approved', updated_at = NOW()
    WHERE id = NEW.id AND status = 'pending';

    IF FOUND THEN
      PERFORM process_group_refund(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_check_refund_approval
  AFTER UPDATE OF total_votes_for, total_votes_against ON group_refund_requests
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'pending')
  EXECUTE FUNCTION check_and_process_refund();

-- --------------------------------------------------------------------------
-- 8. Enhance create_group_with_fee_check to persist schedule & voting fields
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS create_group_with_fee_check(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION create_group_with_fee_check(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_amount NUMERIC,
  p_category TEXT,
  p_frequency TEXT,
  p_privacy TEXT DEFAULT 'public',
  p_enable_voting_rights BOOLEAN DEFAULT true,
  p_contribution_amount NUMERIC DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_voting_threshold NUMERIC DEFAULT 60
) RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_wallet_balance NUMERIC;
  v_balance_after NUMERIC;
  v_creation_fee NUMERIC := 500;
  v_group_id UUID;
  v_transaction_id UUID;
BEGIN
  SELECT
    COALESCE(groups_created_free_remaining, 0),
    COALESCE(wallet_balance, 0)
  INTO v_free_remaining, v_wallet_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
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

    UPDATE profiles
    SET wallet_balance = v_balance_after,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO transactions (
      user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after
    ) VALUES (
      p_user_id, 'withdrawal', v_creation_fee,
      'Group creation fee for: ' || p_name, 'completed', 'wallet',
      'GROUP_FEE_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
      v_wallet_balance, v_balance_after
    ) RETURNING id INTO v_transaction_id;
  END IF;

  INSERT INTO contribution_groups (
    name, description, target_amount, contribution_amount, category, frequency,
    start_date, end_date, creator_id, privacy, status, enable_voting_rights, voting_threshold
  ) VALUES (
    p_name, p_description, p_target_amount, p_contribution_amount, p_category, p_frequency,
    COALESCE(p_start_date, NOW()), p_end_date, p_user_id, p_privacy, 'active', p_enable_voting_rights, p_voting_threshold
  ) RETURNING id INTO v_group_id;

  UPDATE profiles
  SET
    groups_created_count = COALESCE(groups_created_count, 0) + 1,
    groups_created_free_remaining = GREATEST(v_free_remaining - 1, 0),
    updated_at = NOW()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_group_with_fee_check(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_with_fee_check(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC) TO service_role;

-- --------------------------------------------------------------------------
-- 9. Safe Helper RPCs
-- --------------------------------------------------------------------------

-- 9.1 Public/authenticated invitation preview by token
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_inv RECORD;
  v_group RECORD;
  v_inviter RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM group_invitations
  WHERE token = p_token;

  IF v_inv IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF v_inv.status = 'pending' AND v_inv.expires_at < NOW() THEN
    UPDATE group_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN json_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  SELECT id, name, description, target_amount, current_amount, frequency, privacy, category
  INTO v_group
  FROM contribution_groups
  WHERE id = v_inv.group_id;

  SELECT name, email INTO v_inviter
  FROM profiles
  WHERE id = v_inv.inviter_id;

  RETURN json_build_object(
    'success', true,
    'invitation', json_build_object(
      'id', v_inv.id,
      'group_id', v_inv.group_id,
      'inviter_id', v_inv.inviter_id,
      'invitee_email', v_inv.invitee_email,
      'status', v_inv.status,
      'token', v_inv.token,
      'expires_at', v_inv.expires_at,
      'created_at', v_inv.created_at,
      'group', row_to_json(v_group),
      'inviter', json_build_object('name', COALESCE(v_inviter.name, 'Group Admin'))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;

-- 9.2 Safe user lookup by email (returns only UUID, never PII/BVN)
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM profiles
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.lookup_user_id_by_email(TEXT) TO authenticated;

-- 9.3 Safe group contributors list with display names (never exposes BVN/balance/preferences)
CREATE OR REPLACE FUNCTION public.get_group_contributors_safe(p_group_id UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  user_id UUID,
  amount NUMERIC,
  total_contributed NUMERIC,
  contribution_count INTEGER,
  has_voting_rights BOOLEAN,
  join_method VARCHAR,
  anonymous BOOLEAN,
  joined_at TIMESTAMPTZ,
  last_contribution_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  contributor_name TEXT,
  contributor_avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.group_id,
    c.user_id,
    c.amount,
    c.total_contributed::NUMERIC,
    c.contribution_count,
    c.has_voting_rights,
    c.join_method,
    c.anonymous,
    c.joined_at,
    c.last_contribution_at,
    c.metadata,
    c.created_at,
    CASE
      WHEN c.anonymous = true THEN 'Anonymous'
      ELSE COALESCE(p.name, c.metadata->>'senderName', 'Unknown')
    END AS contributor_name,
    CASE
      WHEN c.anonymous = true THEN NULL
      ELSE p.preferences->>'profileImage'
    END AS contributor_avatar
  FROM contributors c
  LEFT JOIN profiles p ON c.user_id = p.id
  WHERE c.group_id = p_group_id
  ORDER BY c.total_contributed DESC, c.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_group_contributors_safe(UUID) TO authenticated;

-- 9.4 Atomic admin wallet deposit RPC
CREATE OR REPLACE FUNCTION public.admin_deposit_to_user(
  p_target_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Admin wallet credit'
) RETURNS JSON AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_tx_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_balance_before
  FROM profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  v_balance_after := v_balance_before + p_amount;

  UPDATE profiles
  SET wallet_balance = v_balance_after,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  INSERT INTO transactions (
    user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_target_user_id, 'deposit', p_amount, p_description, 'completed', 'admin',
    'ADMIN_DEP_' || p_target_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    v_balance_before, v_balance_after,
    json_build_object('credited_by', auth.uid())
  ) RETURNING id INTO v_tx_id;

  INSERT INTO notifications (user_id, type, title, message, is_read)
  VALUES (
    p_target_user_id,
    'wallet_deposit',
    'Wallet Credited',
    format('₦%s has been credited to your wallet by an administrator.', p_amount),
    false
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_deposit_to_user(UUID, NUMERIC, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 10. Enable Realtime on all subscribed tables (idempotent)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'contribution_groups', 'contributors', 'notifications', 'withdrawal_requests', 'group_refund_requests']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
