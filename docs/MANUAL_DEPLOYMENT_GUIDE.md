# Manual Deployment Guide - Contribution Tracking System

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard
   - Select your project: `pzctqflzggjqywuafqar`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query" button

3. **Copy and Paste the Migration**
   - Open the file: `supabase/migrations/create_contributors_tracking.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for success message
   - You should see: "Success. No rows returned"

5. **Verify the Table**
   - Go to "Table Editor" in left sidebar
   - Look for "contributors" table
   - Check that it has these columns:
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

### Option B: Using Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref pzctqflzggjqywuafqar

# Apply the migration
supabase db push

# Or run the specific migration file
supabase migration up
```

---

## Step 2: Deploy Edge Functions

### Deploy webhook-contribution Function

1. **Using Supabase Dashboard**
   
   a. Go to "Edge Functions" in left sidebar
   
   b. Click "Deploy a new function"
   
   c. Function name: `webhook-contribution`
   
   d. Copy the contents of `supabase/functions/webhook-contribution/index.ts`
   
   e. Paste into the editor
   
   f. Click "Deploy function"

2. **Using Supabase CLI (Recommended)**

```bash
# Deploy the webhook function
supabase functions deploy webhook-contribution

# Verify deployment
supabase functions list
```

3. **Get the Function URL**
   - After deployment, copy the function URL
   - It will look like: `https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution`
   - Save this URL for Flutterwave webhook configuration

---

## Step 3: Regenerate TypeScript Types

### Option A: Using Supabase CLI

```bash
# Generate types
supabase gen types typescript --project-id pzctqflzggjqywuafqar > src/integrations/supabase/types.ts

# Restart your dev server
npm run dev
```

### Option B: Manual Download from Dashboard

1. Go to Supabase Dashboard
2. Click "API" in left sidebar
3. Scroll to "Generating Types"
4. Click "Generate types"
5. Copy the generated TypeScript code
6. Replace contents of `src/integrations/supabase/types.ts`

---

## Step 4: Configure Flutterwave Webhook

1. **Login to Flutterwave Dashboard**
   - Go to: https://dashboard.flutterwave.com

2. **Navigate to Webhooks**
   - Settings → Webhooks

3. **Add Webhook URL**
   - URL: `https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution`
   - Events to listen for:
     - ✅ charge.completed
     - ✅ transfer.completed

4. **Save and Test**
   - Click "Save"
   - Use "Test webhook" to verify it's working

---

## Step 5: Verify Everything Works

### Test 1: Check Database

```sql
-- Run in SQL Editor to verify table exists
SELECT * FROM contributors LIMIT 1;

-- Check if contribution_id column was added to transactions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name = 'contribution_id';
```

### Test 2: Check Edge Function

```bash
# Test the webhook function
curl -X POST https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'

# Should return: {"success":false,"message":"Unknown webhook type"}
```

### Test 3: Check Types

```bash
# In your project directory
npm run dev

# Check for TypeScript errors
# There should be no errors related to contributors table
```

---

## Step 6: Update Your Frontend Code

### Add group_id to Payment Metadata

Find where you initialize Flutterwave payment and add group_id:

```typescript
// Example: In your contribution payment component
const handlePayment = () => {
  const config = {
    public_key: 'YOUR_FLUTTERWAVE_PUBLIC_KEY',
    tx_ref: Date.now().toString(),
    amount: contributionAmount,
    currency: 'NGN',
    payment_options: 'card,banktransfer,ussd',
    customer: {
      email: user.email,
      name: user.name,
    },
    customizations: {
      title: `Contribute to ${groupName}`,
      description: 'Group Contribution',
    },
    // ⭐ IMPORTANT: Add this metadata
    meta: {
      group_id: groupId,  // This enables automatic voting rights
    },
  };

  // Initialize Flutterwave payment
  // ...
};
```

### Add Admin Component to Group Page

```typescript
// In your group detail/admin page
import { PendingBankTransfers } from '@/components/contribution/PendingBankTransfers';
import { ContributorService } from '@/services/supabase/contributorService';

function GroupPage({ groupId }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const admin = await ContributorService.isGroupAdmin(groupId, user.id);
        setIsAdmin(admin);
      }
    };
    checkAdmin();
  }, [groupId, user]);

  return (
    <div>
      {/* Your existing group content */}
      
      {/* Add this for admin */}
      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
          <PendingBankTransfers 
            groupId={groupId} 
            isAdmin={isAdmin} 
          />
        </div>
      )}
    </div>
  );
}
```

---

## Troubleshooting

### Migration Fails

**Error: "relation 'contribution_groups' does not exist"**
- You need to create the contribution_groups table first
- Check if you have the contribution groups migration

**Error: "permission denied"**
- Make sure you're using an account with admin access
- Try using the SQL Editor in Supabase Dashboard

### Edge Function Deployment Fails

**Error: "Authentication failed"**
```bash
# Re-login to Supabase
supabase login

# Link project again
supabase link --project-ref pzctqflzggjqywuafqar
```

**Error: "Function already exists"**
```bash
# Delete and redeploy
supabase functions delete webhook-contribution
supabase functions deploy webhook-contribution
```

### TypeScript Errors Persist

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Webhook Not Receiving Events

1. Check Flutterwave webhook logs
2. Verify webhook URL is correct
3. Test with curl command above
4. Check Supabase Edge Function logs:
   - Dashboard → Edge Functions → webhook-contribution → Logs

---

## Verification Checklist

After completing all steps, verify:

- [ ] ✅ Contributors table exists in database
- [ ] ✅ contribution_id column added to transactions table
- [ ] ✅ Edge function deployed successfully
- [ ] ✅ TypeScript types regenerated
- [ ] ✅ No TypeScript errors in project
- [ ] ✅ Flutterwave webhook configured
- [ ] ✅ Payment metadata includes group_id
- [ ] ✅ Admin component added to group pages

---

## Quick Reference

### Important Files
- Migration: `supabase/migrations/create_contributors_tracking.sql`
- Webhook: `supabase/functions/webhook-contribution/index.ts`
- Admin UI: `src/components/contribution/PendingBankTransfers.tsx`
- Services: 
  - `src/services/supabase/contributorService.ts`
  - `src/services/supabase/groupContributionService.ts`

### Important URLs
- Supabase Dashboard: https://supabase.com/dashboard
- Project: https://supabase.com/dashboard/project/pzctqflzggjqywuafqar
- Webhook URL: `https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution`

### Key Commands
```bash
# Deploy edge function
supabase functions deploy webhook-contribution

# Generate types
supabase gen types typescript --project-id pzctqflzggjqywuafqar > src/integrations/supabase/types.ts

# Test webhook
curl -X POST https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
```

---

## Next Steps After Deployment

1. **Test Card Payment Flow**
   - Make a test contribution via card
   - Check if contributor is added with voting rights
   - Verify group amount increases

2. **Test Bank Transfer Flow**
   - Transfer to group account number
   - Check if pending transfer appears
   - Test admin verification

3. **Implement Voting System**
   - Add voting rights checks before allowing votes
   - Show voting eligibility status to users

4. **Monitor and Debug**
   - Check Edge Function logs regularly
   - Monitor contributor table for issues
   - Review pending transfers

---

## Support

If you encounter issues:

1. Check the documentation files:
   - `CONTRIBUTION_TRACKING_SYSTEM.md`
   - `CONTRIBUTION_IMPLEMENTATION_COMPLETE.md`
   - `APPLY_CONTRIBUTOR_MIGRATION.md`

2. Check Supabase logs:
   - Dashboard → Logs
   - Edge Functions → Logs

3. Test with sample data:
   - Use SQL Editor to insert test contributors
   - Verify queries work as expected

Good luck with the deployment! 🚀
