# Contribution System - How It Works

## Overview
The contribution system allows users to contribute money to groups via two methods:
1. **Card/Online Payment** (via Flutterwave) - Grants automatic voting rights
2. **Bank Transfer** (to group's virtual account) - Requires admin verification for voting rights

---

## Flow Diagram

```
User Clicks "Contribute" Button
         ↓
Enter Amount (min ₦100)
         ↓
WalletService.createPaymentInvoice()
         ↓
Creates Flutterwave Payment Link
         ↓
ContributorService.recordPendingContribution()
  - Creates/Updates contributor record (has_voting_rights: false)
  - Updates group current_amount
  - Creates transaction (status: 'pending')
         ↓
User Redirected to Flutterwave Checkout
         ↓
User Completes Payment
         ↓
Flutterwave Webhook → webhook-contribution function
         ↓
handleSuccessfulPayment()
  - Finds user by email
  - Creates transaction (status: 'completed')
  - Calls addContributorWithVotingRights()
    → Sets has_voting_rights: true
    → Updates total_contributed
    → Updates group current_amount
         ↓
User Now Has Voting Rights ✅
```

---

## Key Components

### 1. **ContributeButton Component**
**Location**: `src/components/contribution/ContributeButton.tsx`

**What it does**:
- Shows dialog for user to enter contribution amount
- Validates minimum amount (₦100)
- Calls `WalletService.createPaymentInvoice()` to generate Flutterwave payment link
- Calls `ContributorService.recordPendingContribution()` to record the pending contribution
- Opens Flutterwave checkout in new tab
- Shows success message

**Key Code**:
```typescript
const invoice = await WalletService.createPaymentInvoice({
  amount: contributionAmount,
  description: `Contribution to ${groupName}`,
  customerEmail: user.email,
  customerName: user.name,
  userId: user.id,
  contributionId: groupId  // ← Links payment to group
});

await ContributorService.recordPendingContribution(
  groupId,
  user.id,
  contributionAmount,
  { txRef, flwRef, transactionId, paymentType }
);

window.open(invoice.checkoutUrl, '_blank');
```

---

### 2. **ContributorService**
**Location**: `src/services/supabase/contributorService.ts`

**Key Functions**:

#### `recordPendingContribution()`
- Called immediately after payment link is created
- Creates or updates contributor record with `has_voting_rights: false`
- Updates group's `current_amount`
- Creates transaction with `status: 'pending'`
- Marks as `pendingConfirmation: true` in metadata

#### `addContributor()`
- Called by webhook after successful payment
- Sets `has_voting_rights: true`
- Updates contribution totals
- Used for card/online payments

#### `recordBankTransfer()`
- Called for bank transfers
- Creates anonymous contributor with `has_voting_rights: false`
- Requires admin to manually grant voting rights

#### `hasVotingRights()`
- Checks if user has voting rights in a group
- Used by VotingRightsGuard component

#### `grantVotingRights()`
- Admin function to manually grant voting rights
- Used for bank transfer verification

---

### 3. **Webhook Handler**
**Location**: `supabase/functions/webhook-contribution/index.ts`

**What it does**:
- Receives webhooks from Flutterwave
- Processes successful payments
- Grants voting rights for card payments
- Records bank transfers without voting rights

**Key Functions**:

#### `handleSuccessfulPayment()`
- Triggered by `charge.completed` event
- Finds user by email
- Checks if payment is for a contribution (has `group_id` in metadata)
- Creates transaction with `status: 'completed'`
- Calls `addContributorWithVotingRights()` if it's a contribution
- Updates user wallet balance if not a contribution

#### `addContributorWithVotingRights()`
- Updates or creates contributor with `has_voting_rights: true`
- Updates group's `current_amount`
- Increments `contribution_count`

#### `handleVirtualAccountCredit()`
- Triggered by bank transfer to virtual account
- Records contribution WITHOUT voting rights
- Calls `recordBankTransferContribution()`
- Requires admin verification

---

## Database Schema

### `contributors` Table
```sql
{
  id: uuid,
  group_id: uuid,
  user_id: uuid (nullable for anonymous),
  total_contributed: numeric,
  contribution_count: integer,
  has_voting_rights: boolean,  ← KEY FIELD
  join_method: 'card_payment' | 'bank_transfer' | 'manual',
  anonymous: boolean,
  joined_at: timestamp,
  last_contribution_at: timestamp,
  metadata: jsonb
}
```

### `transactions` Table
```sql
{
  id: uuid,
  user_id: uuid,
  contribution_id: uuid (nullable),
  type: 'deposit' | 'contribution' | 'withdrawal',
  amount: numeric,
  description: text,
  status: 'pending' | 'completed' | 'failed',
  reference_id: text,
  payment_method: text,
  metadata: jsonb
}
```

### `contribution_groups` Table
```sql
{
  id: uuid,
  name: text,
  description: text,
  target_amount: numeric,
  current_amount: numeric,  ← Updated on each contribution
  creator_id: uuid,
  privacy: 'public' | 'private' | 'invite-only',
  account_number: text (virtual account),
  ...
}
```

---

## Voting Rights Logic

### Automatic Voting Rights (Card Payment):
1. User pays via Flutterwave checkout
2. Webhook receives `charge.completed` event
3. `addContributorWithVotingRights()` sets `has_voting_rights: true`
4. User can immediately vote on withdrawal requests

### Manual Voting Rights (Bank Transfer):
1. User transfers to group's virtual account
2. Webhook receives transfer notification
3. `recordBankTransferContribution()` creates contributor with `has_voting_rights: false`
4. Admin sees pending transfer in `PendingBankTransfers` component
5. Admin manually verifies and grants voting rights
6. `grantVotingRights()` sets `has_voting_rights: true`

---

## Current Issues & Limitations

### 1. **Metadata Not Passed to Flutterwave**
**Problem**: The `group_id` is not being passed in the payment metadata, so webhook can't identify contributions.

**Current Code**:
```typescript
// In WalletService.createPaymentInvoice()
const invoiceData = {
  amount,
  customerName,
  customerEmail,
  paymentReference,
  paymentDescription,
  currencyCode: "NGN",
  contractCode: "465595618981",
  redirectUrl: window.location.origin + "/dashboard"
  // ❌ Missing: group_id in metadata
};
```

**Fix Needed**:
```typescript
const invoiceData = {
  // ... existing fields
  meta: {
    group_id: contributionId,  // ← Add this
    user_id: userId,
    payment_type: 'contribution'
  }
};
```

### 2. **Double Recording**
**Problem**: Contribution is recorded twice:
- Once in `recordPendingContribution()` (before payment)
- Again in webhook `addContributorWithVotingRights()` (after payment)

This can cause:
- Duplicate amount additions to `current_amount`
- Incorrect `contribution_count`

**Fix Needed**: Check if contribution already exists before adding in webhook.

### 3. **No Rollback on Failed Payment**
**Problem**: If user abandons payment, the pending contribution remains.

**Fix Needed**: 
- Add expiry time to pending contributions
- Clean up abandoned payments after 24 hours
- Or only record after webhook confirmation

### 4. **Bank Transfer Identification**
**Problem**: Bank transfers to virtual account don't automatically link to groups.

**Current**: All bank transfers go to user's wallet, not group.

**Fix Needed**: 
- Each group should have its own virtual account
- Or use narration/reference to identify group
- Or admin manually assigns transfer to group

---

## What Changes Are Needed?

Based on your request to understand the system, here are the key areas that need improvement:

### Priority 1: Fix Metadata Passing
- Pass `group_id` in Flutterwave payment metadata
- Ensure webhook can identify contributions vs wallet top-ups

### Priority 2: Fix Double Recording
- Only update amounts in webhook, not in `recordPendingContribution()`
- Or check for existing records before adding

### Priority 3: Add Group Virtual Accounts
- Each group gets its own virtual account
- Bank transfers automatically credited to group
- Still requires admin verification for voting rights

### Priority 4: Add Privacy Controls
- Implement the private/public group features
- Control who can contribute based on group privacy
- Add invitation system for private groups

---

## Questions for You:

1. **What specific changes do you want to make to the contribution system?**
   - Fix the double recording issue?
   - Add group-specific virtual accounts?
   - Implement contribution limits?
   - Add recurring contributions?

2. **Should bank transfers ever get automatic voting rights?**
   - Or always require admin verification?

3. **Do you want to add contribution tiers?**
   - e.g., ₦1000 = 1 vote, ₦5000 = 5 votes?

4. **Should there be a minimum contribution for voting rights?**
   - Currently any amount gets voting rights

Let me know what changes you'd like to implement!
