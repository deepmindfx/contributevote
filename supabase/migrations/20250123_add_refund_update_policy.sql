-- Add UPDATE policy for group_refund_requests to allow voting
-- Contributors with voting rights can update refund requests to add their votes

CREATE POLICY "Contributors can update refund requests for voting"
  ON group_refund_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
        AND has_voting_rights = true
    )
  );

COMMENT ON POLICY "Contributors can update refund requests for voting" 
  ON group_refund_requests IS 
  'Allows contributors with voting rights to update refund requests (for casting votes)';

