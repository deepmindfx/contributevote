-- Complete fix for withdrawal_requests and notifications tables
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing tables if they have wrong foreign keys
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Step 2: Recreate withdrawal_requests table with correct references
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES contribution_groups(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  deadline TIMESTAMPTZ NOT NULL,
  votes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Recreate notifications table with correct references
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX idx_withdrawal_requests_contribution ON withdrawal_requests(contribution_id);
CREATE INDEX idx_withdrawal_requests_requester ON withdrawal_requests(requester_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Step 5: Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS Policies for withdrawal_requests
CREATE POLICY "Users can view withdrawal requests for their groups"
  ON withdrawal_requests FOR SELECT
  USING (
    contribution_id IN (
      SELECT group_id FROM contributors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid() AND
    (
      contribution_id IN (
        SELECT id FROM contribution_groups WHERE creator_id = auth.uid()
      )
      OR
      contribution_id IN (
        SELECT group_id FROM contributors 
        WHERE user_id = auth.uid() AND has_voting_rights = true
      )
    )
  );

CREATE POLICY "Users can update withdrawal requests for voting"
  ON withdrawal_requests FOR UPDATE
  USING (
    contribution_id IN (
      SELECT group_id FROM contributors WHERE user_id = auth.uid()
    )
  );

-- Step 7: Create RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Step 8: Create helper functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION expire_withdrawal_requests()
RETURNS void AS $$
BEGIN
  UPDATE withdrawal_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND deadline < NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_group_voters(p_group_id UUID)
RETURNS TABLE (user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT c.user_id
  FROM contributors c
  WHERE c.group_id = p_group_id
    AND c.has_voting_rights = true
    AND c.user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
