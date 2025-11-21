-- Migration: Capture Wallet Balance Snapshot
-- Updates the contribute_from_wallet function to store balance_before and balance_after in transaction metadata
-- for transparency and audit purposes.

CREATE OR REPLACE FUNCTION contribute_from_wallet(
  p_user_id UUID,
  p_group_id UUID,
  p_amount NUMERIC,
  p_anonymous BOOLEAN DEFAULT false
) RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
  v_new_balance NUMERIC;
  v_group_name TEXT;
  v_transaction_id UUID;
  v_contributor_id UUID;
BEGIN
  -- Lock user row to prevent race conditions
  SELECT wallet_balance INTO v_user_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user has sufficient balance
  IF v_user_balance IS NULL OR v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', COALESCE(v_user_balance, 0),
      'required', p_amount
    );
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_user_balance - p_amount;

  -- Get group name for transaction description
  SELECT name INTO v_group_name
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_group_name IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;
  
  -- Deduct from user wallet
  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Add to group current amount
  UPDATE contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;
  
  -- Add or update contributor with instant voting rights
  INSERT INTO contributors (
    group_id,
    user_id,
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
    1,
    true, -- Instant voting rights!
    'wallet',
    p_anonymous,
    NOW(),
    NOW()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = contributors.total_contributed + p_amount,
      contribution_count = contributors.contribution_count + 1,
      has_voting_rights = true,
      last_contribution_at = NOW(),
      updated_at = NOW()
  RETURNING id INTO v_contributor_id;
  
  -- Create transaction record with balance snapshot in metadata
  INSERT INTO transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group_name || ' from wallet',
    'completed',
    'wallet',
    'WALLET_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    p_anonymous,
    json_build_object(
      'source', 'wallet',
      'instant_voting_rights', true,
      'contributor_id', v_contributor_id,
      'balance_before', v_user_balance,
      'balance_after', v_new_balance
    )
  )
  RETURNING id INTO v_transaction_id;
  
  -- Return success with details including balance snapshot
  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'contributor_id', v_contributor_id,
    'new_balance', v_new_balance,
    'balance_before', v_user_balance,
    'voting_rights_granted', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

