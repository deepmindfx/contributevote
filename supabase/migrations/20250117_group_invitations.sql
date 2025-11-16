-- Create group_invitations table for private group invitations
CREATE TABLE IF NOT EXISTS group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES contribution_groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  CONSTRAINT unique_pending_invitation UNIQUE (group_id, invitee_email, status)
);

-- Create indexes for better performance
CREATE INDEX idx_invitations_group ON group_invitations(group_id);
CREATE INDEX idx_invitations_token ON group_invitations(token);
CREATE INDEX idx_invitations_email ON group_invitations(invitee_email);
CREATE INDEX idx_invitations_status ON group_invitations(status);

-- RLS Policies
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- Group admins can view invitations for their groups
CREATE POLICY "Group admins can view invitations"
  ON group_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

-- Group admins can create invitations
CREATE POLICY "Group admins can create invitations"
  ON group_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

-- Group admins can update invitations (cancel)
CREATE POLICY "Group admins can update invitations"
  ON group_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

-- Invitees can view their own invitations
CREATE POLICY "Users can view their invitations"
  ON group_invitations FOR SELECT
  USING (invitee_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Invitees can update their invitations (accept/reject)
CREATE POLICY "Users can update their invitations"
  ON group_invitations FOR UPDATE
  USING (invitee_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Add comment
COMMENT ON TABLE group_invitations IS 'Stores invitations for private and invite-only groups';
