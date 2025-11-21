-- Add withdrawal vote tracking to transactions
-- This ensures votes show up in the user's activity history

-- Create function to record withdrawal vote as a transaction
CREATE OR REPLACE FUNCTION record_withdrawal_vote(
  p_withdrawal_id UUID,
  p_user_id UUID,
  p_vote BOOLEAN
)
RETURNS void AS $$
DECLARE
  v_withdrawal RECORD;
  v_group_name TEXT;
BEGIN
  -- Get withdrawal details
  SELECT wr.* INTO v_withdrawal
  FROM withdrawal_requests wr
  WHERE wr.id = p_withdrawal_id;
  
  -- Get group name
  SELECT name INTO v_group_name
  FROM contribution_groups
  WHERE id = v_withdrawal.contribution_id;
  
  -- Create transaction record for the vote
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
    p_user_id,
    v_withdrawal.contribution_id,
    'vote',
    v_withdrawal.amount, -- Amount being voted on
    format('Voted %s on withdrawal request for %s', 
      CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,
      v_withdrawal.purpose
    ),
    'completed',
    'system',
    'VOTE_' || p_withdrawal_id,
    json_build_object(
      'withdrawal_id', p_withdrawal_id,
      'vote', CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,
      'group_name', v_group_name,
      'withdrawal_amount', v_withdrawal.amount,
      'withdrawal_purpose', v_withdrawal.purpose,
      'voted_at', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the vote function in withdrawalService to also record transactions
-- This is handled in the application code

COMMENT ON FUNCTION record_withdrawal_vote IS 'Records a withdrawal vote as a transaction for activity history tracking';
