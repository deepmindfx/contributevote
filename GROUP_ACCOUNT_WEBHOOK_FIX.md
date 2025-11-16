# Group Account Webhook Fix

## ✅ STATUS: FIXED AND APPLIED

**Problem (RESOLVED):** When someone transfers money to a group's bank account, it was being credited to a user's wallet instead of the group.

**Root Cause:** The webhook (`supabase/functions/webhook-contribution/index.ts`) only checked if the account belonged to a **user**, not a **group**.

**Solution Applied:** The webhook now checks for GROUP accounts FIRST, then user accounts.

---

## 🔧 Required Fix

### Current Logic (WRONG):
```typescript
// Line 348-356 in webhook-contribution/index.ts
// Find user with this virtual account
const { data: users } = await supabase
  .from('profiles')
  .select('*');

const user = users?.find((u: any) => {
  const preferences = u.preferences;
  return preferences?.virtualAccount?.accountNumber === accountNumber;
});
```

This only looks for users, ignoring group accounts!

### New Logic (CORRECT):
```typescript
// STEP 1: Check if account belongs to a GROUP first
const { data: group } = await supabase
  .from('contribution_groups')
  .select('*')
  .eq('account_number', accountNumber)
  .single();

if (group) {
  // This is a GROUP account - credit the group
  return await handleGroupAccountCredit(supabase, group, creditData);
}

// STEP 2: If not a group, check if it's a USER account
const { data: users } = await supabase
  .from('profiles')
  .select('*');

const user = users?.find((u: any) => {
  const preferences = u.preferences;
  return preferences?.virtualAccount?.accountNumber === accountNumber;
});

if (user) {
  // This is a USER account - credit their wallet
  return await handleUserAccountCredit(supabase, user, creditData);
}
```

---

## 📝 Implementation Steps

### Step 1: Add Group Account Credit Handler

Add this new function to `webhook-contribution/index.ts`:

```typescript
// Handle credit to a GROUP virtual account
async function handleGroupAccountCredit(supabase: any, group: any, creditData: any) {
  try {
    const amount = creditData.amount;
    const referenceId = creditData.payment_reference || 
                       creditData.transaction_reference || 
                       creditData.reference || 
                       `GROUP_BANK_${group.id}_${amount}_${Date.now()}`;

    // Check if already processed
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference_id', referenceId)
      .single();

    if (existingTx) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already processed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create transaction record for the group
    await supabase
      .from('transactions')
      .insert({
        user_id: null, // No specific user - it's a group contribution
        contribution_id: group.id,
        type: 'contribution',
        amount: amount,
        description: `Bank transfer to ${group.name}`,
        reference_id: referenceId,
        payment_method: 'bank_transfer',
        status: 'completed',
        metadata: {
          senderName: creditData.sender_name || creditData.originator_name,
          senderBank: creditData.sender_bank || creditData.bank_name,
          accountNumber: creditData.sender_account,
          groupId: group.id,
          groupName: group.name,
          requiresVerification: true,
          note: 'Bank transfer to group account - requires admin verification for voting rights'
        }
      });

    // Update group current amount
    await supabase
      .from('contribution_groups')
      .update({
        current_amount: (group.current_amount || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', group.id);

    // Create pending bank transfer record for admin verification
    await supabase
      .from('pending_bank_transfers')
      .insert({
        group_id: group.id,
        amount: amount,
        sender_name: creditData.sender_name || creditData.originator_name || 'Unknown',
        sender_bank: creditData.sender_bank || creditData.bank_name,
        sender_account: creditData.sender_account,
        reference: referenceId,
        status: 'pending',
        transaction_date: new Date().toISOString(),
        metadata: creditData
      });

    console.log('✅ Group account credited:', { 
      groupId: group.id, 
      groupName: group.name, 
      amount 
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Group account credited successfully',
      data: { 
        groupId: group.id, 
        amount,
        requiresVerification: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling group account credit:', error);
    throw error;
  }
}
```

### Step 2: Update handleVirtualAccountCredit Function

Replace the current function (around line 340) with:

```typescript
async function handleVirtualAccountCredit(supabase: any, creditData: any) {
  try {
    const accountNumber = creditData.account_number || creditData.accountNumber;
    if (!accountNumber) {
      return new Response(JSON.stringify({ success: true, message: 'No account number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STEP 1: Check if this is a GROUP account
    const { data: group, error: groupError } = await supabase
      .from('contribution_groups')
      .select('*')
      .eq('account_number', accountNumber)
      .single();

    if (!groupError && group) {
      console.log('📦 Group account detected:', group.name);
      return await handleGroupAccountCredit(supabase, group, creditData);
    }

    // STEP 2: Check if this is a USER account
    const { data: users } = await supabase
      .from('profiles')
      .select('*');

    const user = users?.find((u: any) => {
      const preferences = u.preferences;
      return preferences?.virtualAccount?.accountNumber === accountNumber;
    });

    if (!user) {
      console.log('⚠️ Account not found:', accountNumber);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('👤 User account detected:', user.email);
    // Continue with existing user account credit logic...
    // (rest of the current function)
  } catch (error) {
    console.error('Error handling virtual account credit:', error);
    throw error;
  }
}
```

---

## 🧪 Testing

After applying the fix:

1. **Test Group Account:**
   - Transfer ₦1000 to a group's account number
   - Check: Group `current_amount` increases by ₦1000
   - Check: Transaction recorded with `contribution_id` = group ID
   - Check: Pending bank transfer created for admin verification
   - Check: User wallet NOT affected

2. **Test User Account:**
   - Transfer ₦1000 to a user's personal account
   - Check: User `wallet_balance` increases by ₦1000
   - Check: Transaction recorded with `user_id`
   - Check: Group NOT affected

---

## 📊 Database Changes Needed

Make sure the `pending_bank_transfers` table exists:

```sql
CREATE TABLE IF NOT EXISTS pending_bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES contribution_groups(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  sender_name TEXT,
  sender_bank TEXT,
  sender_account TEXT,
  reference TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_transfers_group ON pending_bank_transfers(group_id);
CREATE INDEX idx_pending_transfers_status ON pending_bank_transfers(status);
```

---

## ✅ Expected Behavior After Fix

### Group Account Transfer:
1. Money goes to **group wallet**
2. Group `current_amount` increases
3. Shows in **group transactions**
4. Creates pending transfer for admin verification
5. User wallet **NOT affected**

### User Account Transfer:
1. Money goes to **user wallet**
2. User `wallet_balance` increases
3. Shows in **user wallet history**
4. Group **NOT affected**

---

## 🚀 Deployment

1. Update `supabase/functions/webhook-contribution/index.ts`
2. Deploy the edge function:
   ```bash
   supabase functions deploy webhook-contribution
   ```
3. Test with real bank transfers
4. Monitor logs for any issues

---

## 📝 Notes

- This fix is **critical** for proper group functionality
- Without it, all group contributions go to wrong place
- Affects both registered and unregistered contributors
- Admin verification still required for voting rights
