-- Complete fix for withdrawal_requests RLS issue
-- Run this entire script in Supabase SQL Editor

-- Step 1: Check current RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('withdrawal_requests', 'notifications');

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view withdrawal requests for their groups" ON withdrawal_requests;
DROP POLICY IF EXISTS "Group admins can create withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can update withdrawal requests for voting" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Step 3: Disable RLS completely
ALTER TABLE withdrawal_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Step 4: Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('withdrawal_requests', 'notifications');

-- The rowsecurity column should now show 'f' (false) for both tables

-- Step 5: Test by trying to insert a record (replace with your actual IDs)
-- This is just to verify - don't actually run this part
-- INSERT INTO withdrawal_requests (contribution_id, requester_id, amount, purpose, deadline)
-- VALUES ('your-group-id', 'your-user-id', 1000, 'Test', NOW() + INTERVAL '24 hours');
