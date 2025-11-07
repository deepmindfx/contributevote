-- Diagnostic queries to check withdrawal request permissions
-- Run these in Supabase SQL Editor while logged in as the user having issues

-- 1. Check your user ID
SELECT auth.uid() as my_user_id;

-- 2. Check which groups you created
SELECT id, name, creator_id 
FROM contribution_groups 
WHERE creator_id = auth.uid();

-- 3. Check which groups you're a contributor in
SELECT c.group_id, c.user_id, c.has_voting_rights, cg.name as group_name, cg.creator_id
FROM contributors c
JOIN contribution_groups cg ON c.group_id = cg.id
WHERE c.user_id = auth.uid();

-- 4. Check if you can create withdrawal for a specific group
-- Replace 'YOUR-GROUP-ID-HERE' with actual group ID
SELECT 
  'YOUR-GROUP-ID-HERE' as group_id,
  auth.uid() as my_user_id,
  EXISTS(
    SELECT 1 FROM contribution_groups 
    WHERE id = 'YOUR-GROUP-ID-HERE' AND creator_id = auth.uid()
  ) as am_i_creator,
  EXISTS(
    SELECT 1 FROM contributors 
    WHERE group_id = 'YOUR-GROUP-ID-HERE' 
    AND user_id = auth.uid() 
    AND has_voting_rights = true
  ) as do_i_have_voting_rights;

-- 5. Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'withdrawal_requests';
