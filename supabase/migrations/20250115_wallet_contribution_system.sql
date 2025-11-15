-- Migration: Wallet-Based Contribution System
-- Features: Wallet contributions, Recurring payments, Scheduled payments, Group refunds

-- ============================================================================
-- 1. Add new tables for advanced features
-- ============================================================================

-- Recurring Contributions Table
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

CREATE INDEX idx_recurring_contributions_user ON recurring_contributions(user_id);
CREATE INDEX idx_recurring_contributions_group ON recurring_contributions(group_id);
CREATE INDEX idx_recurring_contributions_next_date ON recurring_contributions(next_contribution_date) WHERE is_active = true;

-- Scheduled Contributions Table
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

CREATE INDEX idx_scheduled_contributions_user ON scheduled_contributions(user_id);
CREATE INDEX idx_scheduled_contributions_group ON scheduled_contributions(group_id);
CREATE INDEX idx_scheduled_contributions_date ON scheduled_contributions(scheduled_date) WHERE status = 'pending';

-- Group Refund Requests Table
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

CREATE INDEX idx_refund_requests_group ON group_refund_requests(group_id);
CREATE INDEX idx_refund_requests_status ON group_refund_requests(status);

-- Refund Transactions Table (tracks individual refunds)
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

CREATE INDEX idx_refund_transactions_request ON refund_transactions(refund_request_id);
CREATE INDEX idx_refund_transactions_user ON refund_transactions(user_id);

-- ============================================================================
-- 2. Database Function: Contribute from Wallet
-- ============================================================================

CREATE OR REPLACE FUNCTION contribute_from_wallet(
  p_user_id UUID,
  p_group_id UUID,
  p_amount NUMERIC,
  p_anonymous BOOLEAN DEFAULT false
) RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
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
  
  -- Deduct from user wallet
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
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
    true, -- Instant voting rights!
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
  
  -- Create transaction record
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
    json_build_object(
      'source', 'wallet',
      'instant_voting_rights', true,
      'contributor_id', v_contributor_id
    )
  )
  RETURNING id INTO v_transaction_id;
  
  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'contributor_id', v_contributor_id,
    'new_balance', v_user_balance - p_amount,
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

-- ============================================================================
-- 3. Database Function: Process Group Refund
-- ============================================================================

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
  -- Get refund request details
  SELECT * INTO v_request
  FROM group_refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;
  
  IF v_request IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Refund request not found'
    );
  END IF;
  
  IF v_request.status != 'approved' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Refund request not approved'
    );
  END IF;
  
  -- Process refund for each contributor
  FOR v_contributor IN
    SELECT c.*, p.wallet_balance
    FROM contributors c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.group_id = v_request.group_id
      AND c.total_contributed > 0
  LOOP
    BEGIN
      -- Calculate refund amount
      IF v_request.refund_type = 'full' THEN
        v_refund_amount := v_contributor.total_contributed;
      ELSE
        v_refund_amount := v_contributor.total_contributed * (v_request.partial_percentage / 100);
      END IF;
      
      -- Refund to user wallet
      UPDATE profiles
      SET wallet_balance = wallet_balance + v_refund_amount,
          updated_at = NOW()
      WHERE id = v_contributor.user_id;
      
      -- Create refund transaction
      INSERT INTO transactions (
        user_id,
        contribution_id,
        type,
        amount,
        description,
        status,
        payment_method,
        reference_id,
        metadata
      ) VALUES (
        v_contributor.user_id,
        v_request.group_id,
        'refund',
        v_refund_amount,
        'Group refund: ' || v_request.reason,
        'completed',
        'wallet',
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
      
      -- Record refund transaction
      INSERT INTO refund_transactions (
        refund_request_id,
        user_id,
        group_id,
        original_contribution,
        refund_amount,
        refund_percentage,
        status,
        transaction_id,
        completed_at
      ) VALUES (
        p_refund_request_id,
        v_contributor.user_id,
        v_request.group_id,
        v_contributor.total_contributed,
        v_refund_amount,
        CASE 
          WHEN v_request.refund_type = 'full' THEN 100
          ELSE v_request.partial_percentage
        END,
        'completed',
        v_transaction_id,
        NOW()
      );
      
      v_total_refunded := v_total_refunded + v_refund_amount;
      v_refunds_processed := v_refunds_processed + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Record failed refund
        INSERT INTO refund_transactions (
          refund_request_id,
          user_id,
          group_id,
          original_contribution,
          refund_amount,
          status,
          failure_reason
        ) VALUES (
          p_refund_request_id,
          v_contributor.user_id,
          v_request.group_id,
          v_contributor.total_contributed,
          v_refund_amount,
          'failed',
          SQLERRM
        );
        
        v_refunds_failed := v_refunds_failed + 1;
    END;
  END LOOP;
  
  -- Update group current amount
  UPDATE contribution_groups
  SET current_amount = GREATEST(current_amount - v_total_refunded, 0),
      updated_at = NOW()
  WHERE id = v_request.group_id;
  
  -- Mark refund request as executed
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
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Triggers for automatic updates
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE recurring_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;

-- Recurring contributions policies
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

-- Scheduled contributions policies
CREATE POLICY "Users can view their own scheduled contributions"
  ON scheduled_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled contributions"
  ON scheduled_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled contributions"
  ON scheduled_contributions FOR UPDATE
  USING (auth.uid() = user_id);

-- Refund requests policies
CREATE POLICY "Contributors can view refund requests for their groups"
  ON group_refund_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Contributors can create refund requests"
  ON group_refund_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contributors
      WHERE group_id = group_refund_requests.group_id
        AND user_id = auth.uid()
        AND has_voting_rights = true
    )
  );

-- Refund transactions policies
CREATE POLICY "Users can view their own refund transactions"
  ON refund_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_contribution_wallet 
  ON transactions(contribution_id, payment_method) 
  WHERE payment_method = 'wallet';

CREATE INDEX IF NOT EXISTS idx_contributors_voting_rights 
  ON contributors(group_id, has_voting_rights) 
  WHERE has_voting_rights = true;

-- ============================================================================
-- 7. Comments for documentation
-- ============================================================================

COMMENT ON TABLE recurring_contributions IS 'Stores recurring contribution schedules';
COMMENT ON TABLE scheduled_contributions IS 'Stores one-time scheduled contributions';
COMMENT ON TABLE group_refund_requests IS 'Stores group-wide refund requests with voting';
COMMENT ON TABLE refund_transactions IS 'Tracks individual refund transactions';

COMMENT ON FUNCTION contribute_from_wallet IS 'Processes instant wallet-based contributions with automatic voting rights';
COMMENT ON FUNCTION process_group_refund IS 'Processes approved group refunds to all contributors';
