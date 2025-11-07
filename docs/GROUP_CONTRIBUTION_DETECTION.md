# How Group Contributions Are Detected - Technical Guide

## 🎯 Detection Mechanism

The webhook identifies group contributions by checking for `group_id` in the payment metadata.

## 📊 Flow Diagram

```
Frontend Payment
      ↓
   meta: { group_id: "abc-123" }
      ↓
  Flutterwave
      ↓
   Webhook Receives Payment
      ↓
   Check: paymentData.meta?.group_id
      ↓
   ┌─────────────────┐
   │ group_id found? │
   └────────┬────────┘
            │
     ┌──────┴──────┐
     │             │
    YES           NO
     │             │
     ↓             ↓
Group          Regular
Contribution   Payment
     │             │
     ↓             ↓
Add to         Add to
Contributors   Wallet
+ Voting       Balance
Rights
```

## 🔍 Webhook Detection Code

### Step 1: Extract group_id from Payment Data

```typescript
// Line 152-153 in webhook-contribution/index.ts
const groupId = paymentData.meta?.group_id || paymentData.metadata?.group_id;
const isContribution = !!groupId;
```

**What it checks:**
- `paymentData.meta.group_id` (Flutterwave format)
- `paymentData.metadata.group_id` (Alternative format)
- If either exists → It's a group contribution

### Step 2: Create Transaction with Contribution Flag

```typescript
// Lines 156-182
const transactionData = {
  user_id: user.id,
  contribution_id: isContribution ? groupId : null,  // ← Links to group
  type: isContribution ? 'contribution' : 'deposit', // ← Different type
  amount: paymentData.amount,
  description: isContribution 
    ? `Contribution to group via ${paymentData.payment_type || 'card'}`
    : `Payment received via ${paymentData.payment_type || 'card'}`,
  // ... other fields
  metadata: {
    // ... other metadata
    isContribution,      // ← Flag for easy filtering
    groupId,             // ← Store group ID
    votingRightsGranted: isContribution  // ← Track voting rights
  }
};
```

### Step 3: Add Contributor with Voting Rights

```typescript
// Lines 193-195
if (isContribution) {
  await addContributorWithVotingRights(supabase, groupId, user.id, paymentData.amount);
}
```

**What this does:**
1. Checks if contributor already exists
2. If yes: Updates total_contributed and contribution_count
3. If no: Creates new contributor with `has_voting_rights: true`
4. Updates group's current_amount

### Step 4: Handle Wallet Balance

```typescript
// Lines 197-206
if (!isContribution) {
  // Only update wallet for non-contribution payments
  const currentBalance = user.wallet_balance || 0;
  const newBalance = currentBalance + paymentData.amount;
  // Update wallet...
}
```

**Important:** Group contributions DON'T go to wallet, they go directly to the group!

## 💳 Frontend Implementation

### Required: Include group_id in Payment Metadata

```typescript
// Example using react-flutterwave
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';

function ContributeButton({ groupId, groupName, amount }) {
  const config = {
    public_key: 'FLWPUBK-xxxxx',
    tx_ref: `GROUP_${groupId}_${Date.now()}`,
    amount: amount,
    currency: 'NGN',
    payment_options: 'card,mobilemoney,ussd',
    customer: {
      email: user.email,
      name: user.name,
    },
    customizations: {
      title: `Contribute to ${groupName}`,
      description: `Contributing ₦${amount}`,
    },
    // ⭐ THIS IS CRITICAL - Webhook uses this to identify group contributions
    meta: {
      group_id: groupId,  // REQUIRED for automatic voting rights
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  return (
    <button
      onClick={() => {
        handleFlutterPayment({
          callback: (response) => {
            console.log('Payment successful:', response);
            closePaymentModal();
            // Webhook automatically:
            // 1. Creates transaction with contribution_id
            // 2. Adds user to contributors table
            // 3. Grants voting rights
            // 4. Updates group amount
          },
          onClose: () => {
            console.log('Payment cancelled');
          },
        });
      }}
    >
      Contribute ₦{amount}
    </button>
  );
}
```

## 🏦 Bank Transfer Detection

For virtual account transfers:

```typescript
// In handleVirtualAccountCredit function
const groupId = creditData.meta?.group_id || creditData.metadata?.group_id;
const isContribution = !!groupId;

if (isContribution) {
  // Record as bank transfer contribution (NO voting rights)
  await recordBankTransferContribution(supabase, groupId, amount, senderInfo);
} else {
  // Regular wallet deposit
  // Update user wallet balance
}
```

**Note:** Bank transfers require admin verification because we can't reliably identify the user.

## ✅ Verification: How to Check It's Working

### 1. Check Transaction Record

```sql
-- After a contribution payment
SELECT 
  id,
  user_id,
  contribution_id,  -- Should have group ID
  type,             -- Should be 'contribution'
  amount,
  metadata->>'isContribution',      -- Should be 'true'
  metadata->>'groupId',             -- Should have group ID
  metadata->>'votingRightsGranted'  -- Should be 'true'
FROM transactions
WHERE type = 'contribution'
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Check Contributor Record

```sql
-- After a contribution payment
SELECT 
  id,
  group_id,
  user_id,
  total_contributed,
  has_voting_rights,  -- Should be TRUE
  join_method,        -- Should be 'card_payment'
  joined_at
FROM contributors
WHERE group_id = 'YOUR_GROUP_ID'
ORDER BY joined_at DESC;
```

### 3. Check Group Amount

```sql
-- Group amount should increase
SELECT 
  id,
  name,
  target_amount,
  current_amount,  -- Should increase after contribution
  updated_at
FROM contribution_groups
WHERE id = 'YOUR_GROUP_ID';
```

## 🐛 Troubleshooting

### Problem: Contribution not detected

**Check 1: Is group_id in payment metadata?**
```javascript
// In your payment config
console.log('Payment config:', config);
// Should show: meta: { group_id: "abc-123" }
```

**Check 2: Is webhook receiving the data?**
```typescript
// In webhook, add logging
console.log('Payment data:', paymentData);
console.log('Meta:', paymentData.meta);
console.log('Group ID:', paymentData.meta?.group_id);
```

**Check 3: Check Supabase Edge Function logs**
- Go to Dashboard → Edge Functions → webhook-contribution → Logs
- Look for: "Processing Flutterwave webhook: charge.completed"
- Check if group_id is logged

### Problem: Contributor not added

**Check 1: Is addContributorWithVotingRights being called?**
```typescript
// Should see in logs
console.log('✅ Contributor added with voting rights:', { groupId, userId, amount });
```

**Check 2: Check for database errors**
```sql
-- Check if group exists
SELECT id, name FROM contribution_groups WHERE id = 'YOUR_GROUP_ID';

-- Check if user exists
SELECT id, email FROM profiles WHERE id = 'YOUR_USER_ID';
```

### Problem: Voting rights not granted

**Check 1: Verify has_voting_rights field**
```sql
SELECT 
  user_id,
  has_voting_rights,
  join_method
FROM contributors
WHERE group_id = 'YOUR_GROUP_ID' AND user_id = 'YOUR_USER_ID';
```

**Check 2: Verify it's a card payment (not bank transfer)**
- Bank transfers require manual verification
- Only card/online payments get automatic voting rights

## 📝 Summary

**Detection happens in 3 places:**

1. **Payment Metadata** (Frontend)
   ```javascript
   meta: { group_id: groupId }
   ```

2. **Webhook Detection** (Backend)
   ```typescript
   const groupId = paymentData.meta?.group_id;
   const isContribution = !!groupId;
   ```

3. **Database Storage** (Persistence)
   ```sql
   contribution_id: groupId,
   type: 'contribution',
   metadata: { isContribution: true, groupId, votingRightsGranted: true }
   ```

**Result:**
- ✅ Transaction linked to group
- ✅ Contributor added with voting rights
- ✅ Group amount updated
- ✅ User can vote immediately

## 🎉 It Will Work If:

1. ✅ Frontend includes `group_id` in payment metadata
2. ✅ Webhook is deployed and receiving events
3. ✅ Contributors table exists (migration applied)
4. ✅ Flutterwave webhook is configured correctly

**All the code is already implemented and ready to work!** Just make sure to include `group_id` in your payment metadata.
