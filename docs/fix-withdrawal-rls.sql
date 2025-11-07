-- Fix RLS policy for withdrawal_requests to allow group creators and contributors to create requests

-- Drop the existing policy
DROP POLICY IF EXISTS "Group admins can create withdrawal requests" ON withdrawal_requests;

-- Create a more permissive policy for testing
-- Allows any authenticated user who is either:
-- 1. The creator of the group, OR
-- 2. A contributor with voting rights
CREATE POLICY "Group admins can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid() AND
    (
      -- User is the creator of the group
      contribution_id IN (
        SELECT id FROM contribution_groups WHERE creator_id = auth.uid()
      )
      OR
      -- User is a contributor with voting rights
      contribution_id IN (
        SELECT group_id FROM contributors 
        WHERE user_id = auth.uid() AND has_voting_rights = true
      )
    )
  );

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'withdrawal_requests';
