# Apply Withdrawal & Notifications Migration

## Quick Steps

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/create_withdrawal_and_notifications.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl+Enter`

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 3: Manual SQL Execution

Connect to your Supabase database and run:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/create_withdrawal_and_notifications.sql
```

## What This Migration Creates

### Tables

1. **withdrawal_requests**
   - Stores withdrawal requests from group admins
   - Tracks voting status and deadline (24 hours)
   - Includes votes as JSONB array

2. **notifications**
   - Stores user notifications
   - Alerts contributors about withdrawal requests
   - Tracks read/unread status

### Functions

1. **update_updated_at_column()** - Auto-updates timestamps
2. **expire_withdrawal_requests()** - Marks expired requests
3. **get_group_voters()** - Helper to get voters for a group

### Security

- Row Level Security (RLS) enabled on both tables
- Users can only view withdrawal requests for their groups
- Only group admins can create withdrawal requests
- Users can only see their own notifications

## Verification

After applying the migration, verify in Supabase dashboard:

1. Check **Database** → **Tables**
   - `withdrawal_requests` table exists
   - `notifications` table exists

2. Check **Database** → **Functions**
   - `update_updated_at_column` exists
   - `expire_withdrawal_requests` exists
   - `get_group_voters` exists

3. Test the system:
   - Create a withdrawal request as a group admin
   - Check that notifications are created for group members
   - Visit `/votes` page to see the request
   - Vote on the request

## Troubleshooting

### Error: relation "withdrawal_requests" already exists
- The tables already exist, migration was already applied
- You can skip this migration

### Error: permission denied
- Make sure you're using the service role key or are logged in as admin
- Check RLS policies are correctly configured

### Notifications not appearing
- Check the `notifications` table in Supabase dashboard
- Verify contributors have `has_voting_rights = true`
- Check browser console for errors

## Next Steps

After successful migration:

1. Test withdrawal request creation
2. Verify notifications are sent
3. Test voting functionality
4. Check that requests appear on `/votes` page
