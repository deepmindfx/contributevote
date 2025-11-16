-- Add optional voting rights feature to groups
-- Groups can now be created with or without voting rights
-- Non-voting groups allow admin to withdraw without approval

-- Add enable_voting_rights column to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS enable_voting_rights BOOLEAN DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN groups.enable_voting_rights IS 
'Whether contributors have voting rights on withdrawals. 
If false, admin can withdraw without approval. 
Defaults to true for democratic governance.';

-- Update existing groups to have voting rights enabled by default
UPDATE groups 
SET enable_voting_rights = true 
WHERE enable_voting_rights IS NULL;

-- Create index for filtering groups by voting rights
CREATE INDEX IF NOT EXISTS idx_groups_voting_rights 
ON groups(enable_voting_rights);


-- Create function for instant withdrawal (non-voting groups)
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
  v_group_balance DECIMAL;
  v_admin_wallet_id UUID;
BEGIN
  -- Check if group has voting rights disabled
  IF EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND enable_voting_rights = true
  ) THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  -- Check if user is admin/creator
  IF NOT EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND creator_id = p_admin_id
  ) THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  -- Get current group balance
  SELECT current_amount INTO v_group_balance
  FROM contribution_groups
  WHERE id = p_group_id;

  -- Check if sufficient balance
  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  -- Deduct from group balance
  UPDATE contribution_groups
  SET current_amount = current_amount - p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;

  -- Get admin's wallet
  SELECT id INTO v_admin_wallet_id
  FROM wallets
  WHERE user_id = p_admin_id;

  -- If wallet doesn't exist, create it
  IF v_admin_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, reserved_balance)
    VALUES (p_admin_id, 0, 0)
    RETURNING id INTO v_admin_wallet_id;
  END IF;

  -- Add to admin wallet
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = v_admin_wallet_id;

  -- Record transaction
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

  -- Create notification for admin
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

-- Add comment
COMMENT ON FUNCTION process_instant_withdrawal IS 
'Processes instant withdrawal for non-voting groups. 
Admin can withdraw without approval.';


-- Update create_group_with_fee_check function to include enable_voting_rights
CREATE OR REPLACE FUNCTION create_group_with_fee_check(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_amount DECIMAL,
  p_category TEXT,
  p_frequency TEXT,
  p_privacy TEXT DEFAULT 'public',
  p_enable_voting_rights BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_count INT;
  v_wallet_balance DECIMAL;
  v_group_id UUID;
  v_wallet_id UUID;
  v_fee_amount DECIMAL := 500;
BEGIN
  -- Check how many groups user has created
  SELECT COUNT(*) INTO v_group_count
  FROM contribution_groups
  WHERE creator_id = p_user_id;

  -- If user has created 3 or more groups, charge fee
  IF v_group_count >= 3 THEN
    -- Get user's wallet balance
    SELECT id, balance INTO v_wallet_id, v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id;

    -- Check if wallet exists and has sufficient balance
    IF v_wallet_id IS NULL THEN
      RAISE EXCEPTION 'Wallet not found. Please create a wallet first.';
    END IF;

    IF v_wallet_balance < v_fee_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance. You need ₦% to create a group.', v_fee_amount;
    END IF;

    -- Deduct fee from wallet
    UPDATE wallets
    SET balance = balance - v_fee_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Record transaction
    INSERT INTO wallet_transactions (
      wallet_id,
      type,
      amount,
      description,
      status
    ) VALUES (
      v_wallet_id,
      'group_creation_fee',
      -v_fee_amount,
      'Group creation fee for: ' || p_name,
      'completed'
    );
  END IF;

  -- Create the group
  INSERT INTO contribution_groups (
    creator_id,
    name,
    description,
    target_amount,
    category,
    frequency,
    privacy,
    enable_voting_rights,
    status,
    current_amount
  ) VALUES (
    p_user_id,
    p_name,
    p_description,
    p_target_amount,
    p_category,
    p_frequency,
    p_privacy,
    p_enable_voting_rights,
    'active',
    0
  )
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION create_group_with_fee_check IS 
'Creates a new group with automatic fee deduction for users who have created 3+ groups.
Includes enable_voting_rights parameter to control governance.';
