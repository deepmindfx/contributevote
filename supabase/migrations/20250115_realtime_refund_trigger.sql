-- Function to check and process refund when vote is cast
CREATE OR REPLACE FUNCTION check_and_process_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_votes_for INT;
  v_votes_against INT;
  v_total_votes INT;
  v_eligible_voters INT;
  v_participation_rate DECIMAL;
  v_approval_rate DECIMAL;
  v_approved BOOLEAN;
BEGIN
  -- Only process if status is still pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Use the integer columns that track vote counts
  v_votes_for := COALESCE(NEW.total_votes_for, 0);
  v_votes_against := COALESCE(NEW.total_votes_against, 0);
  v_total_votes := v_votes_for + v_votes_against;

  -- Get total eligible voters (contributors with voting rights)
  SELECT COUNT(*)
  INTO v_eligible_voters
  FROM contributors
  WHERE group_id = NEW.group_id
    AND has_voting_rights = true;

  -- Calculate rates
  IF v_eligible_voters > 0 THEN
    v_participation_rate := (v_total_votes::DECIMAL / v_eligible_voters) * 100;
  ELSE
    v_participation_rate := 0;
  END IF;

  IF v_total_votes > 0 THEN
    v_approval_rate := (v_votes_for::DECIMAL / v_total_votes) * 100;
  ELSE
    v_approval_rate := 0;
  END IF;

  -- Check governance rules: 60% approval + 70% participation
  v_approved := v_approval_rate >= 60 AND v_participation_rate >= 70;

  -- If approved, process refund immediately
  IF v_approved THEN
    -- Call the refund processing function
    PERFORM process_group_refund(NEW.id);
    
    -- Update status to approved (process_group_refund will handle the rest)
    NEW.status := 'approved';
    
    -- Log the instant approval
    RAISE NOTICE 'Refund request % instantly approved: % participation, % approval', 
      NEW.id, v_participation_rate, v_approval_rate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after vote update
DROP TRIGGER IF EXISTS trigger_check_refund_approval ON group_refund_requests;
CREATE TRIGGER trigger_check_refund_approval
  BEFORE UPDATE OF total_votes_for, total_votes_against ON group_refund_requests
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'pending')
  EXECUTE FUNCTION check_and_process_refund();

-- Add comment
COMMENT ON FUNCTION check_and_process_refund() IS 
  'Automatically processes refund when governance thresholds are met (60% approval + 70% participation)';
