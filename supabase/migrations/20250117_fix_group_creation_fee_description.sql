-- Fix Group Creation Fee Transaction Description
-- Update the function to show group name in transaction description and use 'withdrawal' type

CREATE OR REPLACE FUNCTION create_group_with_fee_check(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_amount NUMERIC,
  p_category TEXT,
  p_frequency TEXT,
  p_privacy TEXT DEFAULT 'public',
  p_enable_voting_rights BOOLEAN DEFAULT true
) RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_wallet_balance NUMERIC;
  v_creation_fee NUMERIC := 500;
  v_group_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get user's stats
  SELECT 
    groups_created_free_remaining,
    wallet_balance
  INTO v_free_remaining, v_wallet_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user needs to pay
  IF v_free_remaining <= 0 THEN
    -- User must pay ₦500
    IF v_wallet_balance < v_creation_fee THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'message', format('You need ₦%s to create a group. Current balance: ₦%s', v_creation_fee, v_wallet_balance),
        'required_amount', v_creation_fee,
        'current_balance', v_wallet_balance
      );
    END IF;
    
    -- Deduct fee from wallet
    UPDATE profiles
    SET wallet_balance = wallet_balance - v_creation_fee
    WHERE id = p_user_id;
    
    -- Record transaction with group name in description
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      description,
      status,
      payment_method,
      reference_id
    ) VALUES (
      p_user_id,
      'withdrawal',
      v_creation_fee,
      'Group creation fee for: ' || p_name,
      'completed',
      'wallet',
      'GROUP_FEE_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  -- Create the group
  INSERT INTO contribution_groups (
    name,
    description,
    target_amount,
    category,
    frequency,
    creator_id,
    privacy,
    status,
    enable_voting_rights
  ) VALUES (
    p_name,
    p_description,
    p_target_amount,
    p_category,
    p_frequency,
    p_user_id,
    p_privacy,
    'active',
    p_enable_voting_rights
  ) RETURNING id INTO v_group_id;
  
  -- Update user's group creation stats
  UPDATE profiles
  SET 
    groups_created_count = groups_created_count + 1,
    groups_created_free_remaining = GREATEST(groups_created_free_remaining - 1, 0)
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
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_group_with_fee_check IS 'Create group with automatic fee deduction if user exceeded free limit. Transaction shows group name and uses withdrawal type.';
