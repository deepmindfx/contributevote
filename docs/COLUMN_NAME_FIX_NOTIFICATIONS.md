# Fixed: Column "read" Error ✅

## Issue
```
Error: Failed to run sql query: ERROR: 42703: column "read" does not exist
```

## Root Cause
The word `read` is a reserved keyword in PostgreSQL and can cause issues when used as a column name.

## Solution
Changed column name from `read` to `is_read` throughout the codebase.

## Files Updated

### 1. Migration File
**File:** `supabase/migrations/create_withdrawal_and_notifications.sql`

**Changed:**
```sql
-- Before
read BOOLEAN DEFAULT FALSE,

-- After
is_read BOOLEAN DEFAULT FALSE,
```

**Index Updated:**
```sql
-- Before
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- After
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
```

### 2. WithdrawalRequest Component
**File:** `src/components/contribution/WithdrawalRequest.tsx`

**Changed:**
```typescript
// Before
{
  user_id: c.user_id,
  type: 'withdrawal_request',
  title: 'New Withdrawal Request',
  message: `...`,
  related_id: data.id,
  read: false,  // ❌ Reserved keyword
  created_at: new Date().toISOString()
}

// After
{
  user_id: c.user_id,
  type: 'withdrawal_request',
  title: 'New Withdrawal Request',
  message: `...`,
  related_id: data.id,
  is_read: false,  // ✅ Fixed
  created_at: new Date().toISOString()
}
```

### 3. SupabaseContributionContext
**File:** `src/contexts/SupabaseContributionContext.tsx`

**Changed:**
```typescript
// Before
read: false,

// After
is_read: false,
```

## Database Schema (Updated)

### notifications table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,  -- ✅ Changed from 'read'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Status
✅ **Fixed!** The migration can now be applied without errors.

## Next Steps
1. Apply the updated migration in Supabase Dashboard
2. The `is_read` column will be created correctly
3. All notification code will work properly

## Why This Happened
PostgreSQL has many reserved keywords that can cause issues when used as column names. Common ones include:
- `read`
- `write`
- `user`
- `order`
- `group`
- `table`

**Best Practice:** Use descriptive names like `is_read`, `is_active`, `user_id` to avoid conflicts.
