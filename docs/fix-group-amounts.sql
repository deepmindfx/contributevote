-- Fix group current_amount by recalculating from contributors table
-- This will sync the current_amount field with actual contributions

UPDATE contribution_groups cg
SET current_amount = COALESCE(
  (
    SELECT SUM(total_contributed)
    FROM contributors c
    WHERE c.group_id = cg.id
  ),
  0
),
updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT group_id 
  FROM contributors
);

-- Show the updated groups
SELECT 
  id,
  name,
  current_amount,
  target_amount,
  ROUND((current_amount::numeric / NULLIF(target_amount, 0)::numeric) * 100, 2) as progress_percentage
FROM contribution_groups
ORDER BY created_at DESC;
