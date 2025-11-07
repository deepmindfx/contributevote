-- Drop existing contributors table if it exists (to recreate with new schema)
DROP TABLE IF EXISTS contributors CASCADE;

-- Create contributors table to track who contributed to each group
-- This enables voting rights and member tracking
CREATE TABLE contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES contribution_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Contribution tracking
  total_contributed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  contribution_count INTEGER NOT NULL DEFAULT 0,
  
  -- Voting eligibility (only users who paid via app get voting rights)
  has_voting_rights BOOLEAN DEFAULT FALSE,
  
  -- Track how they joined
  join_method VARCHAR(50) DEFAULT 'card_payment', -- 'card_payment', 'bank_transfer', 'manual'
  
  -- Anonymous contributions
  anonymous BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contribution_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata for additional info (stores sender info for bank transfers)
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contributors_group_id ON contributors(group_id);
CREATE INDEX IF NOT EXISTS idx_contributors_user_id ON contributors(user_id);
CREATE INDEX IF NOT EXISTS idx_contributors_voting_rights ON contributors(group_id, has_voting_rights);

-- Enable Row Level Security
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;

-- Policies - Allow authenticated users full access
CREATE POLICY "Authenticated users can read contributors" ON contributors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contributors" ON contributors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contributors" ON contributors
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete contributors" ON contributors
  FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contributors;

-- Add contribution_id to transactions table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'contribution_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN contribution_id UUID REFERENCES contribution_groups(id) ON DELETE SET NULL;
    CREATE INDEX idx_transactions_contribution_id ON transactions(contribution_id);
  END IF;
END $$;
