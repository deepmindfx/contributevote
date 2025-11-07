-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
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

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_contribution ON withdrawal_requests(contribution_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_requester ON withdrawal_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withdrawal_requests
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view withdrawal requests for their groups" ON withdrawal_requests;
DROP POLICY IF EXISTS "Group admins can create withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can update withdrawal requests for voting" ON withdrawal_requests;

-- Users can view withdrawal requests for groups they're part of
CREATE POLICY "Users can view withdrawal requests for their groups"
  ON withdrawal_requests FOR SELECT
  USING (
    contribution_id IN (
      SELECT group_id FROM contributors WHERE user_id = auth.uid()
    )
  );

-- Only group admins can create withdrawal requests
-- Check if user is the creator of the group OR has admin rights
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
      -- User is a contributor with admin/voting rights
      contribution_id IN (
        SELECT group_id FROM contributors 
        WHERE user_id = auth.uid() AND has_voting_rights = true
      )
    )
  );

-- Users can update withdrawal requests they created (for voting)
CREATE POLICY "Users can update withdrawal requests for voting"
  ON withdrawal_requests FOR UPDATE
  USING (
    contribution_id IN (
      SELECT group_id FROM contributors WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for notifications
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for withdrawal_requests
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically expire withdrawal requests
CREATE OR REPLACE FUNCTION expire_withdrawal_requests()
RETURNS void AS $$
BEGIN
  UPDATE withdrawal_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND deadline < NOW();
END;
$$ LANGUAGE plpgsql;

-- Note: You may want to set up a cron job or scheduled function to call expire_withdrawal_requests() periodically


-- Create a helper function to get voters for a group (avoids TypeScript type issues)
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
