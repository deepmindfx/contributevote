-- ============================================================================
-- COLLECTIPAY MASTER MIGRATION
-- ============================================================================
-- Run this ENTIRE script in your new Supabase project's SQL Editor.
-- It recreates the complete database schema, RLS policies, functions,
-- triggers, and realtime configuration from scratch.
--
-- Generated from: 22 migration files, 8 root SQL files, 18 service files,
-- and the Supabase types definition (types.ts).
--
-- IMPORTANT: After running this, you will also need to:
--   1. Deploy Edge Functions (supabase/functions/) separately
--   2. Update the cron job URLs at the bottom of this file
--   3. Update your .env file with the new Supabase URL and keys
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

-- UUID generation (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cron jobs for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- HTTP requests from SQL (used by cron to call edge functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 profiles
-- Stores user profile data. Linked to auth.users via id (UUID).
-- The wallet_balance field is stored directly here (not in a separate table).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  phone TEXT,
  bvn VARCHAR(11),
  wallet_balance NUMERIC DEFAULT 0,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  preferences JSONB DEFAULT '{}',
  groups_created_count INTEGER DEFAULT 0,
  groups_created_free_remaining INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'User profiles linked to auth.users. Contains wallet balance and preferences.';
COMMENT ON COLUMN profiles.bvn IS 'Bank Verification Number - stored after first wallet creation for reuse in group creation';
COMMENT ON COLUMN profiles.wallet_balance IS 'User wallet balance in NGN';
COMMENT ON COLUMN profiles.groups_created_count IS 'Total number of groups created by user';
COMMENT ON COLUMN profiles.groups_created_free_remaining IS 'Number of free group creations remaining (max 3)';

-- --------------------------------------------------------------------------
-- 2.2 contribution_groups
-- Core table for group funding campaigns.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contribution_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  contribution_amount NUMERIC,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,
  privacy TEXT DEFAULT 'public',
  status TEXT DEFAULT 'active',
  enable_voting_rights BOOLEAN DEFAULT true,
  voting_threshold NUMERIC,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  -- Group account details (for receiving bank transfers)
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  account_reference TEXT,
  account_details JSONB,
  -- Archive support
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category constraint with all supported values
ALTER TABLE contribution_groups ADD CONSTRAINT contribution_groups_category_check 
CHECK (category = ANY (ARRAY[
  'personal'::text,
  'family'::text,
  'community'::text,
  'business'::text,
  'event'::text,
  'education'::text,
  'charity'::text,
  'health'::text,
  'travel'::text,
  'investment'::text,
  'emergency'::text,
  'wedding'::text,
  'birthday'::text,
  'funeral'::text,
  'religious'::text,
  'sports'::text,
  'entertainment'::text,
  'housing'::text,
  'other'::text
]));

COMMENT ON TABLE contribution_groups IS 'Group funding campaigns with support for voting, archiving, and categories';
COMMENT ON COLUMN contribution_groups.enable_voting_rights IS 'Whether contributors have voting rights on withdrawals. If false, admin can withdraw without approval.';
COMMENT ON COLUMN contribution_groups.archived IS 'Whether the group is archived';
COMMENT ON COLUMN contribution_groups.archived_at IS 'When the group was archived';
COMMENT ON COLUMN contribution_groups.archived_by IS 'Who archived the group';

-- --------------------------------------------------------------------------
-- 2.3 contributors
-- Tracks who contributed to each group, amounts, voting rights.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES contribution_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Contribution tracking
  amount NUMERIC DEFAULT 0,
  total_contributed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  contribution_count INTEGER NOT NULL DEFAULT 0,
  -- Voting eligibility
  has_voting_rights BOOLEAN DEFAULT FALSE,
  -- How they joined
  join_method VARCHAR(50) DEFAULT 'card_payment',
  -- Anonymous contributions
  anonymous BOOLEAN DEFAULT FALSE,
  date TIMESTAMPTZ DEFAULT NOW(),
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_contribution_at TIMESTAMPTZ DEFAULT NOW(),
  -- Metadata (stores sender info for bank transfers, etc.)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One contributor record per user per group
  CONSTRAINT contributors_group_user_unique UNIQUE (group_id, user_id)
);

COMMENT ON TABLE contributors IS 'Tracks contributors per group with voting rights and contribution history';
COMMENT ON CONSTRAINT contributors_group_user_unique ON contributors IS 'Ensures one user can only have one contributor record per group';

-- --------------------------------------------------------------------------
-- 2.4 transactions
-- All financial transactions (deposits, withdrawals, contributions, refunds, votes).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contribution_id UUID REFERENCES contribution_groups(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  reference_id TEXT,
  anonymous BOOLEAN DEFAULT false,
  balance_before NUMERIC,
  balance_after NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction type constraint
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type = ANY (ARRAY[
  'deposit'::text, 
  'withdrawal'::text, 
  'transfer'::text, 
  'payment'::text, 
  'vote'::text,
  'contribution'::text,
  'refund'::text
]));

COMMENT ON TABLE transactions IS 'All financial transactions including deposits, withdrawals, contributions, refunds, and votes';
COMMENT ON CONSTRAINT transactions_type_check ON transactions IS 'Allowed transaction types: deposit, withdrawal, transfer, payment, vote, contribution, refund';

-- --------------------------------------------------------------------------
-- 2.5 withdrawal_requests
-- Withdrawal requests that require voting approval.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES contribution_groups(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deadline TIMESTAMPTZ NOT NULL,
  votes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status constraint with all supported values including 'executed'
ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed'));

COMMENT ON TABLE withdrawal_requests IS 'Withdrawal requests requiring voting approval (60% approval, 70% participation, 7 day deadline)';

-- --------------------------------------------------------------------------
-- 2.6 notifications
-- User notifications (withdrawal results, system messages).
-- --------------------------------------------------------------------------
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

COMMENT ON TABLE notifications IS 'User notifications for withdrawal results, system messages, etc.';

-- --------------------------------------------------------------------------
-- 2.7 group_invitations
-- Invitations for private group membership.
-- --------------------------------------------------------------------------
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

COMMENT ON TABLE group_invitations IS 'Stores invitations for private and invite-only groups';

-- --------------------------------------------------------------------------
-- 2.8 recurring_contributions
-- Schedules for automatic recurring contributions.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES contribution_groups(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  next_contribution_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  total_contributions INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  last_contribution_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE recurring_contributions IS 'Stores recurring contribution schedules';

-- --------------------------------------------------------------------------
-- 2.9 scheduled_contributions
-- One-time scheduled future contributions.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES contribution_groups(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  failure_reason TEXT,
  executed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduled_contributions IS 'Stores one-time scheduled contributions';

-- --------------------------------------------------------------------------
-- 2.10 group_refund_requests
-- Group-wide refund requests with voting.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES contribution_groups(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  refund_type TEXT DEFAULT 'full' CHECK (refund_type IN ('full', 'partial')),
  partial_percentage NUMERIC CHECK (partial_percentage > 0 AND partial_percentage <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  voting_deadline TIMESTAMPTZ NOT NULL,
  votes JSONB DEFAULT '[]',
  total_votes_for INTEGER DEFAULT 0,
  total_votes_against INTEGER DEFAULT 0,
  total_eligible_voters INTEGER DEFAULT 0,
  executed_at TIMESTAMPTZ,
  execution_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE group_refund_requests IS 'Group refund requests with real-time voting updates enabled';

-- --------------------------------------------------------------------------
-- 2.11 refund_transactions
-- Individual refund transaction records.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id UUID REFERENCES group_refund_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  group_id UUID REFERENCES contribution_groups(id),
  original_contribution NUMERIC NOT NULL,
  refund_amount NUMERIC NOT NULL,
  refund_percentage NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  failure_reason TEXT,
  transaction_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE refund_transactions IS 'Tracks individual refund transactions';


-- ============================================================================
-- SECTION 3: INDEXES
-- ============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_groups_created ON profiles(groups_created_count);
CREATE INDEX IF NOT EXISTS idx_profiles_bvn ON profiles(id) WHERE bvn IS NOT NULL;

-- contribution_groups
CREATE INDEX IF NOT EXISTS idx_contribution_groups_creator ON contribution_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_contribution_groups_archived ON contribution_groups(archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_groups_privacy ON contribution_groups(privacy);
CREATE INDEX IF NOT EXISTS idx_contribution_groups_status ON contribution_groups(status);
CREATE INDEX IF NOT EXISTS idx_groups_voting_rights ON contribution_groups(enable_voting_rights);

-- contributors
CREATE INDEX IF NOT EXISTS idx_contributors_group_id ON contributors(group_id);
CREATE INDEX IF NOT EXISTS idx_contributors_user_id ON contributors(user_id);
CREATE INDEX IF NOT EXISTS idx_contributors_voting_rights ON contributors(group_id, has_voting_rights) WHERE has_voting_rights = true;

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contribution_id ON transactions(contribution_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contribution_wallet ON transactions(contribution_id, payment_method) WHERE payment_method = 'wallet';
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- withdrawal_requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_contribution ON withdrawal_requests(contribution_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_requester ON withdrawal_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- group_invitations
CREATE INDEX IF NOT EXISTS idx_invitations_group ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON group_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON group_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON group_invitations(status);

-- recurring_contributions
CREATE INDEX IF NOT EXISTS idx_recurring_contributions_user ON recurring_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contributions_group ON recurring_contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contributions_next_date ON recurring_contributions(next_contribution_date) WHERE is_active = true;

-- scheduled_contributions
CREATE INDEX IF NOT EXISTS idx_scheduled_contributions_user ON scheduled_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_contributions_group ON scheduled_contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_contributions_date ON scheduled_contributions(scheduled_date) WHERE status = 'pending';

-- group_refund_requests
CREATE INDEX IF NOT EXISTS idx_refund_requests_group ON group_refund_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON group_refund_requests(status);

-- refund_transactions
CREATE INDEX IF NOT EXISTS idx_refund_transactions_request ON refund_transactions(refund_request_id);
CREATE INDEX IF NOT EXISTS idx_refund_transactions_user ON refund_transactions(user_id);


-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 profiles RLS
-- --------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role bypass for admin operations and triggers
CREATE POLICY "Service role can do anything"
  ON profiles
  USING (auth.jwt()->>'role' = 'service_role');

-- --------------------------------------------------------------------------
-- 4.2 contribution_groups RLS
-- --------------------------------------------------------------------------
ALTER TABLE contribution_groups ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view all groups (needed for discover/public groups)
CREATE POLICY "Authenticated users can view groups"
  ON contribution_groups FOR SELECT
  TO authenticated
  USING (true);

-- Users can create groups
CREATE POLICY "Authenticated users can create groups"
  ON contribution_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Group creators can update their groups
CREATE POLICY "Creators can update their groups"
  ON contribution_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id);

-- Group creators can delete their groups
CREATE POLICY "Creators can delete their groups"
  ON contribution_groups FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- --------------------------------------------------------------------------
-- 4.3 contributors RLS
-- --------------------------------------------------------------------------
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contributors"
  ON contributors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contributors"
  ON contributors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contributors"
  ON contributors FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete contributors"
  ON contributors FOR DELETE
  TO authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- 4.4 transactions RLS
-- --------------------------------------------------------------------------
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create transactions
CREATE POLICY "Authenticated users can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own transactions
CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own transactions
CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 4.5 withdrawal_requests RLS
-- --------------------------------------------------------------------------
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

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

-- --------------------------------------------------------------------------
-- 4.6 notifications RLS
-- --------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 4.7 group_invitations RLS
-- --------------------------------------------------------------------------
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group admins can view invitations"
  ON group_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can create invitations"
  ON group_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can update invitations"
  ON group_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contribution_groups
      WHERE contribution_groups.id = group_invitations.group_id
      AND contribution_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their invitations"
  ON group_invitations FOR SELECT
  USING (invitee_email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their invitations"
  ON group_invitations FOR UPDATE
  USING (invitee_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- --------------------------------------------------------------------------
-- 4.8 recurring_contributions RLS
-- --------------------------------------------------------------------------
ALTER TABLE recurring_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring contributions"
  ON recurring_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring contributions"
  ON recurring_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring contributions"
  ON recurring_contributions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring contributions"
  ON recurring_contributions FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 4.9 scheduled_contributions RLS
-- --------------------------------------------------------------------------
ALTER TABLE scheduled_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled contributions"
  ON scheduled_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled contributions"
  ON scheduled_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled contributions"
  ON scheduled_contributions FOR UPDATE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 4.10 group_refund_requests RLS
-- --------------------------------------------------------------------------
ALTER TABLE group_refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contributors can view refund requests for their groups"
  ON group_refund_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
    )
  );

-- Only group creators can initiate refund requests
CREATE POLICY "Creators can create refund requests"
  ON group_refund_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM contribution_groups
      WHERE contribution_groups.id = group_refund_requests.group_id
        AND contribution_groups.creator_id = auth.uid()
    )
  );

-- Contributors with voting rights can update (cast votes)
CREATE POLICY "Contributors can update refund requests for voting"
  ON group_refund_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
        AND has_voting_rights = true
    )
  );

-- --------------------------------------------------------------------------
-- 4.11 refund_transactions RLS
-- --------------------------------------------------------------------------
ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own refund transactions"
  ON refund_transactions FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================================
-- SECTION 5: DATABASE FUNCTIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 5.1 update_updated_at_column() - Generic timestamp trigger
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 5.2 handle_new_user() - Auto-create profile on signup
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, wallet_balance, role, status, preferences, groups_created_count, groups_created_free_remaining, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    0,
    'user',
    'active',
    jsonb_build_object(
      'darkMode', true,
      'anonymousContributions', false,
      'notificationsEnabled', true
    ),
    0,
    3,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 5.3 contribute_from_wallet() - Wallet-based contributions with balance tracking
-- (Final version from 20250121_add_balance_tracking.sql)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION contribute_from_wallet(
  p_user_id UUID,
  p_group_id UUID,
  p_amount NUMERIC,
  p_anonymous BOOLEAN DEFAULT false
) RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
  v_new_balance NUMERIC;
  v_group_name TEXT;
  v_transaction_id UUID;
  v_contributor_id UUID;
BEGIN
  -- Lock user row to prevent race conditions
  SELECT wallet_balance INTO v_user_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user has sufficient balance
  IF v_user_balance IS NULL OR v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', COALESCE(v_user_balance, 0),
      'required', p_amount
    );
  END IF;
  
  -- Get group name for transaction description
  SELECT name INTO v_group_name
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_group_name IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_user_balance - p_amount;
  
  -- Deduct from user wallet
  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Add to group current amount
  UPDATE contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;
  
  -- Add or update contributor with instant voting rights
  INSERT INTO contributors (
    group_id,
    user_id,
    total_contributed,
    contribution_count,
    has_voting_rights,
    join_method,
    anonymous,
    joined_at,
    last_contribution_at
  ) VALUES (
    p_group_id,
    p_user_id,
    p_amount,
    1,
    true,
    'wallet',
    p_anonymous,
    NOW(),
    NOW()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = contributors.total_contributed + p_amount,
      contribution_count = contributors.contribution_count + 1,
      has_voting_rights = true,
      last_contribution_at = NOW(),
      updated_at = NOW()
  RETURNING id INTO v_contributor_id;
  
  -- Create transaction record with balance tracking
  INSERT INTO transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group_name || ' from wallet',
    'completed',
    'wallet',
    'WALLET_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    p_anonymous,
    v_user_balance,
    v_new_balance,
    json_build_object(
      'source', 'wallet',
      'instant_voting_rights', true,
      'contributor_id', v_contributor_id
    )
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'contributor_id', v_contributor_id,
    'balance_before', v_user_balance,
    'new_balance', v_new_balance,
    'voting_rights_granted', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION contribute_from_wallet IS 'Processes instant wallet-based contributions with automatic voting rights and balance tracking';

-- --------------------------------------------------------------------------
-- 5.4 process_group_refund() - Process approved refunds
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_group_refund(
  p_refund_request_id UUID
) RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_contributor RECORD;
  v_refund_amount NUMERIC;
  v_total_refunded NUMERIC := 0;
  v_refunds_processed INTEGER := 0;
  v_refunds_failed INTEGER := 0;
  v_transaction_id UUID;
BEGIN
  SELECT * INTO v_request
  FROM group_refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;
  
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not found');
  END IF;
  
  IF v_request.status != 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not approved');
  END IF;
  
  FOR v_contributor IN
    SELECT c.*, p.wallet_balance
    FROM contributors c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.group_id = v_request.group_id
      AND c.total_contributed > 0
  LOOP
    BEGIN
      IF v_request.refund_type = 'full' THEN
        v_refund_amount := v_contributor.total_contributed;
      ELSE
        v_refund_amount := v_contributor.total_contributed * (v_request.partial_percentage / 100);
      END IF;
      
      UPDATE profiles
      SET wallet_balance = wallet_balance + v_refund_amount,
          updated_at = NOW()
      WHERE id = v_contributor.user_id;
      
      INSERT INTO transactions (
        user_id, contribution_id, type, amount, description, status,
        payment_method, reference_id, metadata
      ) VALUES (
        v_contributor.user_id, v_request.group_id, 'refund', v_refund_amount,
        'Group refund: ' || v_request.reason, 'completed', 'wallet',
        'REFUND_' || p_refund_request_id || '_' || v_contributor.user_id,
        json_build_object(
          'refund_request_id', p_refund_request_id,
          'original_contribution', v_contributor.total_contributed,
          'refund_percentage', CASE 
            WHEN v_request.refund_type = 'full' THEN 100
            ELSE v_request.partial_percentage
          END
        )
      )
      RETURNING id INTO v_transaction_id;
      
      INSERT INTO refund_transactions (
        refund_request_id, user_id, group_id, original_contribution,
        refund_amount, refund_percentage, status, transaction_id, completed_at
      ) VALUES (
        p_refund_request_id, v_contributor.user_id, v_request.group_id,
        v_contributor.total_contributed, v_refund_amount,
        CASE WHEN v_request.refund_type = 'full' THEN 100 ELSE v_request.partial_percentage END,
        'completed', v_transaction_id, NOW()
      );
      
      v_total_refunded := v_total_refunded + v_refund_amount;
      v_refunds_processed := v_refunds_processed + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        INSERT INTO refund_transactions (
          refund_request_id, user_id, group_id, original_contribution,
          refund_amount, status, failure_reason
        ) VALUES (
          p_refund_request_id, v_contributor.user_id, v_request.group_id,
          v_contributor.total_contributed, v_refund_amount, 'failed', SQLERRM
        );
        v_refunds_failed := v_refunds_failed + 1;
    END;
  END LOOP;
  
  UPDATE contribution_groups
  SET current_amount = GREATEST(current_amount - v_total_refunded, 0),
      updated_at = NOW()
  WHERE id = v_request.group_id;
  
  UPDATE group_refund_requests
  SET status = 'executed',
      executed_at = NOW(),
      execution_details = json_build_object(
        'total_refunded', v_total_refunded,
        'refunds_processed', v_refunds_processed,
        'refunds_failed', v_refunds_failed
      ),
      updated_at = NOW()
  WHERE id = p_refund_request_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Refund processed successfully',
    'total_refunded', v_total_refunded,
    'refunds_processed', v_refunds_processed,
    'refunds_failed', v_refunds_failed
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_group_refund IS 'Processes approved group refunds to all contributors';

-- --------------------------------------------------------------------------
-- 5.5 check_group_creation_eligibility() - Free group creation check
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_group_creation_eligibility(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_total_created INTEGER;
  v_can_create_free BOOLEAN;
  v_creation_fee NUMERIC := 500;
BEGIN
  SELECT 
    groups_created_free_remaining,
    groups_created_count
  INTO v_free_remaining, v_total_created
  FROM profiles
  WHERE id = p_user_id;
  
  v_can_create_free := v_free_remaining > 0;
  
  RETURN json_build_object(
    'can_create_free', v_can_create_free,
    'free_remaining', v_free_remaining,
    'total_created', v_total_created,
    'creation_fee', CASE WHEN v_can_create_free THEN 0 ELSE v_creation_fee END,
    'message', CASE 
      WHEN v_can_create_free THEN 
        format('You have %s free group(s) remaining', v_free_remaining)
      ELSE 
        format('Group creation fee: ₦%s (You''ve used all %s free groups)', v_creation_fee, 3)
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_group_creation_eligibility IS 'Check if user can create group for free or needs to pay ₦500';

-- --------------------------------------------------------------------------
-- 5.6 create_group_with_fee_check() - Create group with auto fee deduction
-- (Final version from 20250117_fix_group_creation_fee_description.sql)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_group_with_fee_check(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_amount NUMERIC,
  p_category TEXT,
  p_frequency TEXT,
  p_privacy TEXT DEFAULT 'public',
  p_enable_voting_rights BOOLEAN DEFAULT true
) RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_wallet_balance NUMERIC;
  v_creation_fee NUMERIC := 500;
  v_group_id UUID;
  v_transaction_id UUID;
BEGIN
  SELECT 
    groups_created_free_remaining,
    wallet_balance
  INTO v_free_remaining, v_wallet_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_free_remaining <= 0 THEN
    IF v_wallet_balance < v_creation_fee THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'message', format('You need ₦%s to create a group. Current balance: ₦%s', v_creation_fee, v_wallet_balance),
        'required_amount', v_creation_fee,
        'current_balance', v_wallet_balance
      );
    END IF;
    
    UPDATE profiles
    SET wallet_balance = wallet_balance - v_creation_fee
    WHERE id = p_user_id;
    
    INSERT INTO transactions (
      user_id, type, amount, description, status, payment_method, reference_id
    ) VALUES (
      p_user_id, 'withdrawal', v_creation_fee,
      'Group creation fee for: ' || p_name, 'completed', 'wallet',
      'GROUP_FEE_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  INSERT INTO contribution_groups (
    name, description, target_amount, category, frequency,
    creator_id, privacy, status, enable_voting_rights
  ) VALUES (
    p_name, p_description, p_target_amount, p_category, p_frequency,
    p_user_id, p_privacy, 'active', p_enable_voting_rights
  ) RETURNING id INTO v_group_id;
  
  UPDATE profiles
  SET 
    groups_created_count = groups_created_count + 1,
    groups_created_free_remaining = GREATEST(groups_created_free_remaining - 1, 0)
  WHERE id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'group_id', v_group_id,
    'fee_charged', CASE WHEN v_free_remaining > 0 THEN 0 ELSE v_creation_fee END,
    'free_remaining', GREATEST(v_free_remaining - 1, 0),
    'transaction_id', v_transaction_id,
    'message', CASE 
      WHEN v_free_remaining > 0 THEN 'Group created successfully (free)'
      ELSE format('Group created successfully (₦%s charged)', v_creation_fee)
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_group_with_fee_check IS 'Create group with automatic fee deduction if user exceeded free limit. Transaction shows group name and uses withdrawal type.';

-- --------------------------------------------------------------------------
-- 5.7 archive_group() / unarchive_group()
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_group(
  p_group_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  SELECT creator_id INTO v_creator_id
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_creator_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;
  
  IF v_creator_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the group creator can archive this group');
  END IF;
  
  UPDATE contribution_groups
  SET archived = true, archived_at = NOW(), archived_by = p_user_id, status = 'completed'
  WHERE id = p_group_id;
  
  RETURN json_build_object('success', true, 'message', 'Group archived successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unarchive_group(
  p_group_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  SELECT creator_id INTO v_creator_id
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_creator_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;
  
  IF v_creator_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the group creator can unarchive this group');
  END IF;
  
  UPDATE contribution_groups
  SET archived = false, archived_at = NULL, archived_by = NULL, status = 'active'
  WHERE id = p_group_id;
  
  RETURN json_build_object('success', true, 'message', 'Group unarchived successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_group IS 'Archive a group (only creator can archive)';
COMMENT ON FUNCTION unarchive_group IS 'Unarchive a group (only creator can unarchive)';

-- --------------------------------------------------------------------------
-- 5.8 process_approved_withdrawal() - Execute approved withdrawals
-- (Final version from 20250123_fix_withdrawal_balance.sql)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_approved_withdrawal(p_withdrawal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_group RECORD;
  v_group_balance NUMERIC := 0;
  v_admin_balance NUMERIC;
BEGIN
  SELECT * INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  
  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;
  
  IF v_withdrawal.status != 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not approved');
  END IF;
  
  SELECT * INTO v_group
  FROM contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;

  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contribution group not found');
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);

  IF v_group_balance < v_withdrawal.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient group balance');
  END IF;
  
  UPDATE contribution_groups
  SET current_amount = v_group_balance - v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.contribution_id;
  
  UPDATE profiles
  SET wallet_balance = wallet_balance + v_withdrawal.amount,
      updated_at = NOW()
  WHERE id = v_withdrawal.requester_id
  RETURNING wallet_balance INTO v_admin_balance;
  
  INSERT INTO transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, metadata
  ) VALUES (
    v_withdrawal.requester_id, v_withdrawal.contribution_id, 'withdrawal',
    v_withdrawal.amount, 'Withdrawal approved: ' || v_withdrawal.purpose,
    'completed', 'wallet', 'WITHDRAWAL_' || p_withdrawal_id,
    json_build_object(
      'withdrawal_id', p_withdrawal_id,
      'group_id', v_withdrawal.contribution_id,
      'purpose', v_withdrawal.purpose,
      'votes', v_withdrawal.votes
    )
  );
  
  UPDATE withdrawal_requests
  SET status = 'executed', updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    v_withdrawal.requester_id, 'withdrawal_completed', 'Withdrawal Approved',
    format('₦%s has been credited to your wallet', v_withdrawal.amount),
    v_withdrawal.contribution_id, false
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Withdrawal processed successfully',
    'amount', v_withdrawal.amount,
    'admin_new_balance', v_admin_balance
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_approved_withdrawal IS 'Process approved withdrawal: deduct from group, credit admin wallet, create transactions';

-- --------------------------------------------------------------------------
-- 5.9 check_withdrawal_voting() - Auto approve/reject based on thresholds
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_withdrawal_voting(p_withdrawal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_withdrawal RECORD;
  v_total_voters INTEGER;
  v_votes_cast INTEGER;
  v_yes_votes INTEGER;
  v_participation_rate NUMERIC;
  v_approval_rate NUMERIC;
  v_should_approve BOOLEAN := false;
  v_should_reject BOOLEAN := false;
BEGIN
  SELECT * INTO v_withdrawal
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id;
  
  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not pending');
  END IF;
  
  SELECT COUNT(*) INTO v_total_voters
  FROM contributors
  WHERE group_id = v_withdrawal.contribution_id
    AND has_voting_rights = true;
  
  IF v_total_voters = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No eligible voters');
  END IF;
  
  SELECT 
    jsonb_array_length(v_withdrawal.votes),
    COUNT(*) FILTER (WHERE (value->>'vote')::boolean = true)
  INTO v_votes_cast, v_yes_votes
  FROM jsonb_array_elements(v_withdrawal.votes);
  
  v_participation_rate := (v_votes_cast::NUMERIC / v_total_voters::NUMERIC) * 100;
  v_approval_rate := CASE 
    WHEN v_votes_cast > 0 THEN (v_yes_votes::NUMERIC / v_votes_cast::NUMERIC) * 100
    ELSE 0
  END;
  
  IF v_participation_rate >= 70 AND v_approval_rate >= 60 THEN
    v_should_approve := true;
  END IF;
  
  IF v_withdrawal.deadline < NOW() THEN
    IF v_participation_rate < 70 OR v_approval_rate < 60 THEN
      v_should_reject := true;
    END IF;
  END IF;
  
  IF v_should_approve THEN
    UPDATE withdrawal_requests
    SET status = 'approved', updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    RETURN process_approved_withdrawal(p_withdrawal_id);
  END IF;
  
  IF v_should_reject THEN
    UPDATE withdrawal_requests
    SET status = 'rejected', updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
    VALUES (
      v_withdrawal.requester_id, 'withdrawal_rejected', 'Withdrawal Rejected',
      'Voting thresholds not met within deadline', v_withdrawal.contribution_id, false
    );
    
    RETURN json_build_object('success', true, 'status', 'rejected', 'reason', 'Thresholds not met');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'status', 'pending',
    'participation_rate', v_participation_rate,
    'approval_rate', v_approval_rate,
    'votes_cast', v_votes_cast,
    'total_voters', v_total_voters
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_withdrawal_voting IS 'Check voting thresholds (70% participation, 60% approval) and auto-approve/reject';

-- --------------------------------------------------------------------------
-- 5.10 process_instant_withdrawal() - For non-voting groups
-- Rewritten to use profiles.wallet_balance instead of abandoned wallets table
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_instant_withdrawal(
  p_group_id UUID,
  p_admin_id UUID,
  p_amount DECIMAL,
  p_purpose TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_balance DECIMAL := 0;
  v_admin_balance DECIMAL;
BEGIN
  -- Check if group has voting rights disabled
  IF EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND enable_voting_rights = true
  ) THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  -- Check if user is admin/creator
  IF NOT EXISTS (
    SELECT 1 FROM contribution_groups 
    WHERE id = p_group_id 
    AND creator_id = p_admin_id
  ) THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  -- Get current group balance
  SELECT COALESCE(current_amount, 0) INTO v_group_balance
  FROM contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  -- Deduct from group balance
  UPDATE contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;

  -- Credit admin wallet balance in profiles
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_admin_id
  RETURNING wallet_balance INTO v_admin_balance;

  -- Record in transactions table
  INSERT INTO transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, metadata
  ) VALUES (
    p_admin_id, p_group_id, 'withdrawal', p_amount,
    'Instant withdrawal: ' || p_purpose, 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || p_group_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting'
    )
  );

  -- Create notification for admin
  INSERT INTO notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id, 'withdrawal_completed', 'Withdrawal Successful',
    format('₦%s withdrawn from group and added to your wallet', p_amount),
    p_group_id, false
  );
END;
$$;

COMMENT ON FUNCTION process_instant_withdrawal IS 'Processes instant withdrawal for non-voting groups. Admin can withdraw without approval.';

-- --------------------------------------------------------------------------
-- 5.11 check_and_process_refund() - Trigger function for refund auto-approval
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_and_process_refund()
RETURNS TRIGGER AS $$
DECLARE
  v_votes_for INT;
  v_votes_against INT;
  v_total_votes INT;
  v_eligible_voters INT;
  v_participation_rate DECIMAL;
  v_approval_rate DECIMAL;
  v_approved BOOLEAN;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_votes_for := COALESCE(NEW.total_votes_for, 0);
  v_votes_against := COALESCE(NEW.total_votes_against, 0);
  v_total_votes := v_votes_for + v_votes_against;

  SELECT COUNT(*)
  INTO v_eligible_voters
  FROM contributors
  WHERE group_id = NEW.group_id
    AND has_voting_rights = true;

  IF v_eligible_voters > 0 THEN
    v_participation_rate := (v_total_votes::DECIMAL / v_eligible_voters) * 100;
  ELSE
    v_participation_rate := 0;
  END IF;

  IF v_total_votes > 0 THEN
    v_approval_rate := (v_votes_for::DECIMAL / v_total_votes) * 100;
  ELSE
    v_approval_rate := 0;
  END IF;

  v_approved := v_approval_rate >= 60 AND v_participation_rate >= 70;

  IF v_approved THEN
    PERFORM process_group_refund(NEW.id);
    NEW.status := 'approved';
    RAISE NOTICE 'Refund request % instantly approved: % participation, % approval', 
      NEW.id, v_participation_rate, v_approval_rate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_and_process_refund() IS 'Automatically processes refund when governance thresholds are met (60% approval + 70% participation)';

-- --------------------------------------------------------------------------
-- 5.12 get_group_voters() - Helper for voting queries
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- 5.13 expire_withdrawal_requests() - Expire past-deadline requests
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_withdrawal_requests()
RETURNS void AS $$
BEGIN
  UPDATE withdrawal_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND deadline < NOW();
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 5.14 record_withdrawal_vote() - Record vote as transaction
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_withdrawal_vote(
  p_withdrawal_id UUID,
  p_user_id UUID,
  p_vote BOOLEAN
)
RETURNS void AS $$
DECLARE
  v_withdrawal RECORD;
  v_group_name TEXT;
BEGIN
  SELECT wr.* INTO v_withdrawal
  FROM withdrawal_requests wr
  WHERE wr.id = p_withdrawal_id;
  
  SELECT name INTO v_group_name
  FROM contribution_groups
  WHERE id = v_withdrawal.contribution_id;
  
  INSERT INTO transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, metadata
  ) VALUES (
    p_user_id, v_withdrawal.contribution_id, 'vote',
    v_withdrawal.amount,
    format('Voted %s on withdrawal request for %s', 
      CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,
      v_withdrawal.purpose
    ),
    'completed', 'system', 'VOTE_' || p_withdrawal_id,
    json_build_object(
      'withdrawal_id', p_withdrawal_id,
      'vote', CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,
      'group_name', v_group_name,
      'withdrawal_amount', v_withdrawal.amount,
      'withdrawal_purpose', v_withdrawal.purpose,
      'voted_at', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_withdrawal_vote IS 'Records a withdrawal vote as a transaction for activity history tracking';


-- ============================================================================
-- SECTION 6: TRIGGERS
-- ============================================================================

-- Auth trigger: auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_contributions_updated_at
  BEFORE UPDATE ON recurring_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_contributions_updated_at
  BEFORE UPDATE ON scheduled_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON group_refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Refund auto-approval trigger
DROP TRIGGER IF EXISTS trigger_check_refund_approval ON group_refund_requests;
CREATE TRIGGER trigger_check_refund_approval
  BEFORE UPDATE OF total_votes_for, total_votes_against ON group_refund_requests
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'pending')
  EXECUTE FUNCTION check_and_process_refund();


-- ============================================================================
-- SECTION 7: REALTIME
-- ============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE contributors;
ALTER PUBLICATION supabase_realtime ADD TABLE group_refund_requests;


-- ============================================================================
-- SECTION 8: GRANTS
-- ============================================================================

-- Grant execute permissions on key functions
GRANT EXECUTE ON FUNCTION contribute_from_wallet(UUID, UUID, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION contribute_from_wallet(UUID, UUID, NUMERIC, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION process_group_refund(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_group_refund(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_group_creation_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_group_creation_eligibility(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_group_with_fee_check(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_with_fee_check(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION archive_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_group(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION unarchive_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_group(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_approved_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_approved_withdrawal(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_withdrawal_voting(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_withdrawal_voting(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_instant_withdrawal(UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_instant_withdrawal(UUID, UUID, DECIMAL, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_group_voters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_voters(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION record_withdrawal_vote(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION record_withdrawal_vote(UUID, UUID, BOOLEAN) TO service_role;


-- ============================================================================
-- SECTION 9: CRON JOBS (REQUIRES URL UPDATE)
-- ============================================================================
-- ⚠️  IMPORTANT: Replace YOUR_NEW_SUPABASE_URL below with your actual new
-- Supabase project URL (e.g., https://abc123.supabase.co)
-- Then uncomment the cron.schedule calls.
-- ============================================================================

-- Process recurring & scheduled contributions every 15 minutes
-- SELECT cron.schedule(
--   'process-scheduled-contributions',
--   '*/15 * * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/process-scheduled-contributions',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--       ),
--       body := '{}'::jsonb
--     ) as request_id;
--   $$
-- );

-- Check refund deadlines every hour
-- SELECT cron.schedule(
--   'check-refund-deadlines',
--   '0 * * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/process-scheduled-contributions',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--       ),
--       body := jsonb_build_object('deadlines_only', true)
--     ) as request_id;
--   $$
-- );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ CollectiPay master migration completed successfully!';
  RAISE NOTICE '   Tables created: profiles, contribution_groups, contributors, transactions,';
  RAISE NOTICE '                   withdrawal_requests, notifications, group_invitations,';
  RAISE NOTICE '                   recurring_contributions, scheduled_contributions,';
  RAISE NOTICE '                   group_refund_requests, refund_transactions';
  RAISE NOTICE '   Functions: 14 database functions created';
  RAISE NOTICE '   Triggers: 6 triggers configured';
  RAISE NOTICE '   RLS: All tables secured with row-level security';
  RAISE NOTICE '   Realtime: contributors, group_refund_requests';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '   1. Deploy Edge Functions from supabase/functions/';
  RAISE NOTICE '   2. Uncomment and update cron job URLs in Section 9';
  RAISE NOTICE '   3. Update .env with new VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY';
  RAISE NOTICE '   4. Update src/integrations/supabase/client.ts with new URL and key';
END $$;
