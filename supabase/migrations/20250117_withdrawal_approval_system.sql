-- Withdrawal Approval System with Voting
-- Implements: 60% approval, 70% participation, 7 days deadline

-- Function to process approved withdrawal requests
CREATE OR REPLACE FUNCTION process_approved_withdrawal(p_withdrawal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_group RECORD;
  v_admin_balance NUMERIC;
BEGIN
  -- Get withdrawal request details
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
  
  -- Get group details
  SELECT * INTO v_group
  FROM contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;
  
  -- Check if group has sufficient balance
  IF v_group.current_amount < v_withdrawal.amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient group balance'
    );
  END IF;
  
  -- Deduct from group balance
  UPDATE contribution_groups
  SET current_amount = current_amount - v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.contribution_id;
  
  -- Credit admin wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance + v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.requester_id
  RETURNING wallet_balance INTO v_admin_balance;
  
  -- Create transaction for group deduction
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
  
  -- Mark withdrawal as executed
  UPDATE withdrawal_requests
  SET status = 'executed',
      updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  -- Notify admin
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

-- Function to check and auto-approve/reject withdrawals based on voting
CREATE OR REPLACE FUNCTION check_withdrawal_voting(p_withdrawal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_total_voters INTEGER;
  v_votes_cast INTEGER;
  v_yes_votes INTEGER;
  v_participation_rate NUMERIC;
  v_approval_rate NUMERIC;
  v_should_approve BOOLEAN := false;
  v_should_reject BOOLEAN := false;
BEGIN
  -- Get withdrawal details
  SELECT * INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id;
  
  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not pending');
  END IF;
  
  -- Count total eligible voters (contributors with voting rights)
  SELECT COUNT(*) INTO v_total_voters
  FROM contributors
  WHERE group_id = v_withdrawal.contribution_id
    AND has_voting_rights = true;
  
  IF v_total_voters = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No eligible voters');
  END IF;
  
  -- Count votes from the votes JSONB array
  SELECT 
    jsonb_array_length(v_withdrawal.votes),
    COUNT(*) FILTER (WHERE (value->>'vote')::boolean = true)
  INTO v_votes_cast, v_yes_votes
  FROM jsonb_array_elements(v_withdrawal.votes);
  
  -- Calculate rates
  v_participation_rate := (v_votes_cast::NUMERIC / v_total_voters::NUMERIC) * 100;
  v_approval_rate := CASE 
    WHEN v_votes_cast > 0 THEN (v_yes_votes::NUMERIC / v_votes_cast::NUMERIC) * 100
    ELSE 0
  END;
  
  -- Check if thresholds are met (70% participation, 60% approval)
  IF v_participation_rate >= 70 AND v_approval_rate >= 60 THEN
    v_should_approve := true;
  END IF;
  
  -- Check if deadline passed
  IF v_withdrawal.deadline < NOW() THEN
    IF v_participation_rate < 70 OR v_approval_rate < 60 THEN
      v_should_reject := true;
    END IF;
  END IF;
  
  -- Auto-approve if thresholds met
  IF v_should_approve THEN
    UPDATE withdrawal_requests
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    -- Process the withdrawal
    RETURN process_approved_withdrawal(p_withdrawal_id);
  END IF;
  
  -- Auto-reject if deadline passed and thresholds not met
  IF v_should_reject THEN
    UPDATE withdrawal_requests
    SET status = 'rejected',
        updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    -- Notify admin
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_id,
      is_read
    ) VALUES (
      v_withdrawal.requester_id,
      'withdrawal_rejected',
      'Withdrawal Rejected',
      'Voting thresholds not met within deadline',
      v_withdrawal.contribution_id,
      false
    );
    
    RETURN json_build_object(
      'success', true,
      'status', 'rejected',
      'reason', 'Thresholds not met'
    );
  END IF;
  
  -- Still pending
  RETURN json_build_object(
    'success', true,
    'status', 'pending',
    'participation_rate', v_participation_rate,
    'approval_rate', v_approval_rate,
    'votes_cast', v_votes_cast,
    'total_voters', v_total_voters
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add executed status to withdrawal_requests if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'withdrawal_requests_status_check'
  ) THEN
    ALTER TABLE withdrawal_requests 
    DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
    
    ALTER TABLE withdrawal_requests 
    ADD CONSTRAINT withdrawal_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed'));
  END IF;
END $$;

COMMENT ON FUNCTION process_approved_withdrawal IS 'Process approved withdrawal: deduct from group, credit admin wallet, create transactions';
COMMENT ON FUNCTION check_withdrawal_voting IS 'Check voting thresholds (70% participation, 60% approval) and auto-approve/reject';
