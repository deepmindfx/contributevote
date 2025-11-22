-- Add BVN field to profiles table for storage and reuse
-- This allows users to enter BVN once during wallet creation
-- and automatically use it for group wallet creation

-- Add bvn column to profiles table (encrypted storage recommended in production)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bvn VARCHAR(11);

-- Add comment to explain the column
COMMENT ON COLUMN profiles.bvn IS 'Bank Verification Number - stored after first wallet creation for reuse in group creation';

-- Create index for quick lookup (optional, since we'll mostly query by id)
CREATE INDEX IF NOT EXISTS idx_profiles_bvn ON profiles(id) WHERE bvn IS NOT NULL;

