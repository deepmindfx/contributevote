# Apply Contributor Tracking Migration

## Important: Run Migration First

Before the contribution tracking system will work, you MUST apply the database migration.

## Steps to Apply Migration

### Option 1: Using Supabase CLI (Recommended)
```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/create_contributors_tracking.sql`
4. Paste and run the SQL

### Option 3: Using MCP Supabase Tool
```typescript
// Use the apply_migration tool
await mcp_supabase_apply_migration({
  project_id: "YOUR_PROJECT_ID",
  name: "create_contributors_tracking",
  query: `-- SQL from create_contributors_tracking.sql file`
});
```

## After Migration

### 1. Regenerate TypeScript Types
```bash
# Using Supabase CLI
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/integrations/supabase/types.ts

# Or using MCP tool
await mcp_supabase_generate_typescript_types({
  project_id: "YOUR_PROJECT_ID"
});
```

### 2. Verify Migration
Check that the `contributors` table exists with these columns:
- id
- group_id
- user_id
- total_contributed
- contribution_count
- has_voting_rights
- join_method
- anonymous
- joined_at
- last_contribution_at
- metadata
- created_at
- updated_at

### 3. Deploy Webhook Function
```bash
# Deploy the updated webhook
supabase functions deploy webhook-contribution
```

## Verification

### Test Card Payment Flow
1. User contributes via card/bank payment
2. Check `contributors` table - should have entry with `has_voting_rights: true`
3. Check `transactions` table - should have `contribution_id` set
4. Verify group `current_amount` increased

### Test Bank Transfer Flow
1. User transfers to account number
2. Check `contributors` table - should have entry with `has_voting_rights: false`
3. Check metadata contains sender info
4. Admin should see in pending transfers

### Test Admin Verification
1. Admin views pending transfers
2. Admin links transfer to user
3. Check `has_voting_rights` updated to `true`
4. User can now vote

## Troubleshooting

### TypeScript Errors
If you see TypeScript errors about missing properties:
- Regenerate types after migration
- Restart your development server
- Clear TypeScript cache

### Migration Fails
If migration fails with "table already exists":
- The migration includes `DROP TABLE IF EXISTS`
- Check if you have data you want to keep
- Backup data before running migration

### Webhook Not Working
- Verify webhook is deployed
- Check Supabase logs for errors
- Ensure webhook URL is configured in Flutterwave
- Test webhook with sample payload

## Next Steps

After successful migration:
1. ✅ Contributors table created
2. ✅ Types regenerated
3. ✅ Webhook deployed
4. → Integrate payment flow with group_id
5. → Add PendingBankTransfers component to admin pages
6. → Implement voting rights checks
7. → Test end-to-end flow
