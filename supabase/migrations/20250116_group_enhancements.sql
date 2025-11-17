-- Group Enhancements Migration
-- Features: More categories, Archive groups, Group creation limits, Sorting

-- ============================================================================
-- 1. Add More Categories
-- ============================================================================

-- Drop old category constraint
ALTER TABLE contribution_groups DROP CONSTRAINT IF EXISTS contribution_groups_category_check;

-- Add new constraint with more categories
ALTER TABLE contribution_groups ADD CONSTRAINT contribution_groups_category_check 
CHECK (category = ANY (ARRAY[
  'personal'::text,
  'family'::text,
  'community'::text,
  'business'::text,
  'event'::text,
  'education'::text,
  'charity'::text,        -- New: For charitable causes
  'health'::text,         -- New: Medical bills, health insurance
  'travel'::text,         -- New: Group trips, vacations
  'investment'::text,     -- New: Investment clubs
  'emergency'::text,      -- New: Emergency funds
  'wedding'::text,        -- New: Wedding contributions
  'birthday'::text,       -- New: Birthday gifts
  'funeral'::text,        -- New: Funeral expenses
  'religious'::text,      -- New: Church, mosque contributions
  'sports'::text,         -- New: Sports teams, tournaments
  'entertainment'::text,  -- New: Parties, concerts
  'housing'::text,        -- New: Rent, house purchase
  'other'::text
]));

-- ============================================================================
-- 2. Add Archive Status
-- ============================================================================

-- Add archived column
ALTER TABLE contribution_groups 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE contribution_groups 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add archived_by (who archived it)
ALTER TABLE contribution_groups 
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

-- Create index for filtering archived groups
CREATE INDEX IF NOT EXISTS idx_contribution_groups_archived 
ON contribution_groups(archived, created_at DESC);

-- ============================================================================
-- 3. Add Group Creation Tracking
-- ============================================================================

-- Add groups_created_count to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS groups_created_count INTEGER DEFAULT 0;

-- Add groups_created_free_remaining to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS groups_created_free_remaining INTEGER DEFAULT 3;

-- Create index for tracking
CREATE INDEX IF NOT EXISTS idx_profiles_groups_created 
ON profiles(groups_created_count);

-- ============================================================================
-- 4. Function to Check Group Creation Eligibility
-- ============================================================================

CREATE OR REPLACE FUNCTION check_group_creation_eligibility(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_total_created INTEGER;
  v_can_create_free BOOLEAN;
  v_creation_fee NUMERIC := 500; -- ₦500 per group after free limit
BEGIN
  -- Get user's group creation stats
  SELECT 
    groups_created_free_remaining,
    groups_created_count
  INTO v_free_remaining, v_total_created
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if user can create for free
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

-- ============================================================================
-- 5. Function to Create Group with Fee Check
-- ============================================================================

CREATE OR REPLACE FUNCTION create_group_with_fee_check(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_target_amount NUMERIC,
  p_category TEXT,
  p_frequency TEXT,
  p_privacy TEXT DEFAULT 'public'
) RETURNS JSON AS $$
DECLARE
  v_free_remaining INTEGER;
  v_wallet_balance NUMERIC;
  v_creation_fee NUMERIC := 500;
  v_group_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get user's stats
  SELECT 
    groups_created_free_remaining,
    wallet_balance
  INTO v_free_remaining, v_wallet_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user needs to pay
  IF v_free_remaining <= 0 THEN
    -- User must pay ₦500
    IF v_wallet_balance < v_creation_fee THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'message', format('You need ₦%s to create a group. Current balance: ₦%s', v_creation_fee, v_wallet_balance),
        'required_amount', v_creation_fee,
        'current_balance', v_wallet_balance
      );
    END IF;
    
    -- Deduct fee from wallet
    UPDATE profiles
    SET wallet_balance = wallet_balance - v_creation_fee
    WHERE id = p_user_id;
    
    -- Record transaction
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      description,
      status,
      payment_method,
      reference_id
    ) VALUES (
      p_user_id,
      'withdrawal',
      v_creation_fee,
      'Group creation fee for: ' || p_name,
      'completed',
      'wallet',
      'GROUP_FEE_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  -- Create the group
  INSERT INTO contribution_groups (
    name,
    description,
    target_amount,
    category,
    frequency,
    creator_id,
    privacy,
    status
  ) VALUES (
    p_name,
    p_description,
    p_target_amount,
    p_category,
    p_frequency,
    p_user_id,
    p_privacy,
    'active'
  ) RETURNING id INTO v_group_id;
  
  -- Update user's group creation stats
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
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Function to Archive Group
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_group(
  p_group_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  -- Check if user is the creator
  SELECT creator_id INTO v_creator_id
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;
  
  IF v_creator_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only the group creator can archive this group'
    );
  END IF;
  
  -- Archive the group
  UPDATE contribution_groups
  SET 
    archived = true,
    archived_at = NOW(),
    archived_by = p_user_id,
    status = 'completed'
  WHERE id = p_group_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Group archived successfully'
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
-- 7. Function to Unarchive Group
-- ============================================================================

CREATE OR REPLACE FUNCTION unarchive_group(
  p_group_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  -- Check if user is the creator
  SELECT creator_id INTO v_creator_id
  FROM contribution_groups
  WHERE id = p_group_id;
  
  IF v_creator_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;
  
  IF v_creator_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only the group creator can unarchive this group'
    );
  END IF;
  
  -- Unarchive the group
  UPDATE contribution_groups
  SET 
    archived = false,
    archived_at = NULL,
    archived_by = NULL,
    status = 'active'
  WHERE id = p_group_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Group unarchived successfully'
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
-- 8. Add Comments
-- ============================================================================

COMMENT ON COLUMN contribution_groups.archived IS 'Whether the group is archived';
COMMENT ON COLUMN contribution_groups.archived_at IS 'When the group was archived';
COMMENT ON COLUMN contribution_groups.archived_by IS 'Who archived the group';
COMMENT ON COLUMN profiles.groups_created_count IS 'Total number of groups created by user';
COMMENT ON COLUMN profiles.groups_created_free_remaining IS 'Number of free group creations remaining (max 3)';

COMMENT ON FUNCTION check_group_creation_eligibility IS 'Check if user can create group for free or needs to pay ₦500';
COMMENT ON FUNCTION create_group_with_fee_check IS 'Create group with automatic fee deduction if user exceeded free limit';
COMMENT ON FUNCTION archive_group IS 'Archive a group (only creator can archive)';
COMMENT ON FUNCTION unarchive_group IS 'Unarchive a group (only creator can unarchive)';

-- ============================================================================
-- 9. Update Existing Users
-- ============================================================================

-- Give existing users their 3 free groups
UPDATE profiles 
SET 
  groups_created_free_remaining = 3,
  groups_created_count = 0
WHERE groups_created_free_remaining IS NULL;

