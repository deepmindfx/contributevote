-- TEMPORARY: Disable RLS on contributors table for testing
-- This allows immediate contribution recording while we debug the webhook
-- Run this in Supabase SQL Editor

-- Disable RLS temporarily
ALTER TABLE contributors DISABLE ROW LEVEL SECURITY;

-- You can re-enable it later with:
-- ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
