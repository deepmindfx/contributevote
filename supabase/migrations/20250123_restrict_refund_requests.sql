-- Restrict refund request creation to group creators only
-- Update RLS policy on group_refund_requests

ALTER TABLE group_refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contributors can create refund requests" ON group_refund_requests;

CREATE POLICY "Creators can create refund requests"
  ON group_refund_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM contribution_groups
      WHERE contribution_groups.id = group_refund_requests.group_id
        AND contribution_groups.creator_id = auth.uid()
    )
  );

