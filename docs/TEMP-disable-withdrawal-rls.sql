-- TEMPORARY: Disable RLS for testing withdrawal requests
-- This will help us identify if the issue is with the RLS policy

-- Disable RLS temporarily
ALTER TABLE withdrawal_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable with:
-- ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
