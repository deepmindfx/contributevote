-- Fix withdrawal balance handling and guard against null balances
-- Ensures group balances are always deducted correctly and prevents null math issues

-- Updated process_approved_withdrawal to coalesce group balance
CREATE OR REPLACE FUNCTION process_approved_withdrawal(p_withdrawal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_group RECORD;
  v_group_balance NUMERIC := 0;
  v_admin_balance NUMERIC;
BEGIN
  SELECT * INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF v_withdrawal IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Withdrawal request not found'
    );
  END IF;
  
  IF v_withdrawal.status != 'approved' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Withdrawal request not approved'
    );
  END IF;
  
  SELECT * INTO v_group
  FROM contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;

  IF v_group IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Contribution group not found'
    );
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);

  IF v_group_balance < v_withdrawal.amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient group balance'
    );
  END IF;
  
  UPDATE contribution_groups
  SET current_amount = v_group_balance - v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.contribution_id;
  
  UPDATE profiles
  SET wallet_balance = wallet_balance + v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.requester_id
  RETURNING wallet_balance INTO v_admin_balance;
  
  INSERT INTO transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    metadata
  ) VALUES (
    v_withdrawal.requester_id,
    v_withdrawal.contribution_id,
    'withdrawal',
    v_withdrawal.amount,
    'Withdrawal approved: ' || v_withdrawal.purpose,
    'completed',
    'wallet',
    'WITHDRAWAL_' || p_withdrawal_id,
    json_build_object(
      'withdrawal_id', p_withdrawal_id,
      'group_id', v_withdrawal.contribution_id,
      'purpose', v_withdrawal.purpose,
      'votes', v_withdrawal.votes
    )
  );
  
  UPDATE withdrawal_requests
  SET status = 'executed',
      updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_id,
    is_read
  ) VALUES (
    v_withdrawal.requester_id,
    'withdrawal_completed',
    'Withdrawal Approved',
    format('₦%s has been credited to your wallet', v_withdrawal.amount),
    v_withdrawal.contribution_id,
    false
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Withdrawal processed successfully',
    'amount', v_withdrawal.amount,
    'admin_new_balance', v_admin_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated process_instant_withdrawal to coalesce group balance
CREATE OR REPLACE FUNCTION process_instant_withdrawal(
  p_group_id UUID,
  p_admin_id UUID,
  p_amount DECIMAL,
  p_purpose TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_balance DECIMAL := 0;
  v_admin_wallet_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND enable_voting_rights = true
  ) THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND creator_id = p_admin_id
  ) THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  SELECT COALESCE(current_amount, 0) INTO v_group_balance
  FROM contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  UPDATE contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;

  SELECT id INTO v_admin_wallet_id
  FROM wallets
  WHERE user_id = p_admin_id;

  IF v_admin_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, reserved_balance)
    VALUES (p_admin_id, 0, 0)
    RETURNING id INTO v_admin_wallet_id;
  END IF;

  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = v_admin_wallet_id;

  INSERT INTO wallet_transactions (
    wallet_id,
    type,
    amount,
    description,
    status,
    metadata
  ) VALUES (
    v_admin_wallet_id,
    'group_withdrawal',
    p_amount,
    'Instant withdrawal: ' || p_purpose,
    'completed',
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting'
    )
  );

  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_id,
    is_read
  ) VALUES (
    p_admin_id,
    'withdrawal_completed',
    'Withdrawal Successful',
    format('₦%s withdrawn from group and added to your wallet', p_amount),
    p_group_id,
    false
  );
END;
$$;

