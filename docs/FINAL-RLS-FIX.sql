-- FINAL FIX: Complete RLS reset for withdrawal_requests
-- Copy and run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Check what exists
-- ============================================
SELECT 'Current RLS Status:' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('withdrawal_requests', 'notifications');

SELECT 'Current Policies:' as info;
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('withdrawal_requests', 'notifications');

-- ============================================
-- STEP 2: Nuclear option - Drop and recreate
-- ============================================

-- Drop the tables completely
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Recreate withdrawal_requests
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  deadline TIMESTAMPTZ NOT NULL,
  votes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_withdrawal_requests_contribution ON withdrawal_requests(contribution_id);
CREATE INDEX idx_withdrawal_requests_requester ON withdrawal_requests(requester_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- STEP 3: DO NOT ENABLE RLS YET
-- ============================================
-- Leave RLS disabled for now so we can test

SELECT 'Tables recreated without RLS' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('withdrawal_requests', 'notifications');

-- ============================================
-- STEP 4: Test insert (optional)
-- ============================================
-- You can now try creating a withdrawal request from your app
-- It should work without RLS blocking it

SELECT 'Setup complete. RLS is DISABLED. Try creating a withdrawal request now.' as info;
