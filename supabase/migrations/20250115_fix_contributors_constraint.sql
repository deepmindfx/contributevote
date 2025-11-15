-- Add unique constraint to contributors table for ON CONFLICT to work
-- This ensures one user can only have one contributor record per group

ALTER TABLE contributors 
ADD CONSTRAINT contributors_group_user_unique 
UNIQUE (group_id, user_id);

-- Add comment
COMMENT ON CONSTRAINT contributors_group_user_unique ON contributors IS 
  'Ensures one user can only have one contributor record per group';
