-- TEMPORARY FIX: Allow any authenticated user to create withdrawal requests
-- This is for testing only - make it more restrictive in production

-- Drop the existing policy
DROP POLICY IF EXISTS "Group admins can create withdrawal requests" ON withdrawal_requests;

-- Create a permissive policy for testing
CREATE POLICY "Group admins can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
  );

-- This allows any authenticated user to create a withdrawal request
-- Once you verify it works, replace with the more restrictive policy from fix-withdrawal-rls.sql
