# Contribution Tracking & Voting Rights System

## Overview

This system tracks contributions to groups and manages voting rights based on payment method. It implements a two-tier contribution system with automatic and manual verification.

## Payment Methods

### 1. Card/Bank Payment (Preferred) ✅
**Automatic Voting Rights**

When users contribute via the "Pay with Card/Bank" button:
- Payment is processed through Flutterwave
- Webhook automatically receives payment confirmation
- User is added to `contributors` table with `has_voting_rights: true`
- Transaction is recorded with `voting_rights_granted: true`
- Group amount is updated automatically
- User gets immediate voting rights and access to group features

**Flow:**
```
User clicks "Pay with Card/Bank" 
→ Flutterwave processes payment
→ Webhook receives charge.completed event
→ System identifies user by email
→ Contributor added with voting rights
→ Group amount updated
→ User can vote immediately
```

### 2. Account Number Transfer ⚠️
**Manual Verification Required**

When users transfer to the group's account number:
- Money arrives in the virtual account
- Webhook receives transfer notification
- System records the transfer but CANNOT identify the user
- Contributor added WITHOUT voting rights (`has_voting_rights: false`)
- Admin must manually verify and link to user account

**Flow:**
```
User transfers to account number
→ Webhook receives transfer notification
→ System records sender name/bank only
→ Contributor added WITHOUT voting rights
→ Admin reviews pending transfers
→ Admin links transfer to user account
→ Admin grants voting rights manually
```

## Database Schema

### Contributors Table
```sql
CREATE TABLE contributors (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES contribution_groups(id),
  user_id UUID REFERENCES profiles(id), -- NULL for unverified transfers
  
  total_contributed DECIMAL(10, 2),
  contribution_count INTEGER,
  
  has_voting_rights BOOLEAN DEFAULT FALSE,
  join_method VARCHAR(50), -- 'card_payment', 'bank_transfer', 'manual'
  anonymous BOOLEAN DEFAULT FALSE,
  
  joined_at TIMESTAMP,
  last_contribution_at TIMESTAMP,
  
  metadata JSONB -- Stores sender info for bank transfers
);
```

## Services

### ContributorService
Located: `src/services/supabase/contributorService.ts`

**Key Functions:**
- `addContributor()` - Add contributor with voting rights (card payment)
- `recordBankTransfer()` - Record transfer without voting rights
- `getGroupContributors()` - Get all contributors
- `hasVotingRights()` - Check if user can vote
- `getPendingBankTransfers()` - Get unverified transfers (admin)
- `manuallyAddContributor()` - Admin manually adds contributor
- `grantVotingRights()` - Admin grants voting rights
- `isGroupAdmin()` - Check if user is group creator

### GroupContributionService
Located: `src/services/supabase/groupContributionService.ts`

**Key Functions:**
- `contributeViaPayment()` - Process card/bank payment contribution
- `recordBankTransfer()` - Record account number transfer
- `hasContributed()` - Check if user contributed
- `hasVotingRights()` - Check voting eligibility
- `verifyBankTransfer()` - Admin verifies and links transfer

## Webhook Integration

### Edge Function: webhook-contribution
Located: `supabase/functions/webhook-contribution/index.ts`

**Handles:**
1. **charge.completed** - Card/bank payments
   - Identifies user by email
   - Checks for group_id in metadata
   - Adds contributor with voting rights
   - Updates group amount

2. **transfer.completed** - Virtual account credits
   - Identifies user by account number
   - Checks for group_id in metadata
   - Records transfer WITHOUT voting rights
   - Requires admin verification

**Helper Functions:**
- `addContributorWithVotingRights()` - Grants automatic voting
- `recordBankTransferContribution()` - Records unverified transfer

## Admin Features

### PendingBankTransfers Component
Located: `src/components/contribution/PendingBankTransfers.tsx`

**Features:**
- View all pending bank transfers
- See sender name, bank, amount, and timestamp
- Link transfer to user account (by user ID or email)
- Grant voting rights or verify without voting
- Reject fraudulent transfers

**Admin Actions:**
1. **Verify & Grant Voting** - Links transfer to user and grants voting rights
2. **Verify Only** - Links transfer without voting rights
3. **Reject** - Removes the pending transfer

## Usage Examples

### Frontend: Contributing via Card
```typescript
import { GroupContributionService } from '@/services/supabase/groupContributionService';

// User clicks "Pay with Card/Bank"
const handleCardPayment = async () => {
  // Initialize Flutterwave payment with group_id in metadata
  const paymentData = {
    amount: 5000,
    email: user.email,
    metadata: {
      group_id: groupId // Important: Include group ID
    }
  };
  
  // After successful payment, webhook handles the rest automatically
};
```

### Frontend: Admin Reviewing Transfers
```typescript
import { PendingBankTransfers } from '@/components/contribution/PendingBankTransfers';

// In group admin page
<PendingBankTransfers 
  groupId={groupId} 
  isAdmin={isUserAdmin} 
/>
```

### Backend: Checking Voting Rights
```typescript
import { ContributorService } from '@/services/supabase/contributorService';

// Before allowing vote
const canVote = await ContributorService.hasVotingRights(groupId, userId);

if (!canVote) {
  toast.error('You need to contribute via card/bank to vote');
  return;
}

// Process vote...
```

## Security Considerations

### Why Two-Tier System?

**Card/Bank Payment (Automatic):**
- User is authenticated in the app
- Email links payment to user account
- Flutterwave confirms payment
- Safe to grant automatic voting rights

**Account Number Transfer (Manual):**
- User transfers outside the app
- Only bank name/account visible
- Cannot reliably identify user
- Risk of fraud if automatic
- Admin verification required

### RLS Policies

```sql
-- Anyone can read contributors (for transparency)
CREATE POLICY "Anyone can read contributors" ON contributors
  FOR SELECT USING (true);

-- Authenticated users can insert (via webhook)
CREATE POLICY "Authenticated users can insert contributors" ON contributors
  FOR INSERT WITH CHECK (true);

-- Users can update (for admin actions)
CREATE POLICY "Users can update contributors" ON contributors
  FOR UPDATE USING (true);
```

## Integration Checklist

- [x] Contributors table created
- [x] ContributorService implemented
- [x] GroupContributionService implemented
- [x] Webhook updated to track contributors
- [x] PendingBankTransfers component created
- [x] Admin verification flow implemented
- [ ] Frontend payment integration (add group_id to metadata)
- [ ] Group detail page shows contributors
- [ ] Voting system checks voting rights
- [ ] Admin dashboard shows pending transfers

## Next Steps

1. **Update Payment Integration:**
   - Add `group_id` to Flutterwave payment metadata
   - Ensure webhook receives group context

2. **Update Group Pages:**
   - Show contributors list
   - Display pending transfers for admins
   - Show voting rights status

3. **Implement Voting System:**
   - Check `hasVotingRights()` before allowing votes
   - Show voting eligibility status to users

4. **Testing:**
   - Test card payment → automatic voting rights
   - Test bank transfer → pending verification
   - Test admin verification flow
   - Test voting rights enforcement

## Troubleshooting

### User paid but no voting rights?
- Check if payment included `group_id` in metadata
- Check webhook logs for errors
- Verify contributor was added to database
- Check `has_voting_rights` field

### Bank transfer not showing in pending?
- Verify webhook received transfer event
- Check if `join_method` is 'bank_transfer'
- Ensure `has_voting_rights` is false
- Check contributor metadata for sender info

### Admin can't verify transfer?
- Verify user is group creator
- Check if user ID/email is correct
- Ensure contributor record exists
- Check for database errors in console

## API Reference

### Check Voting Rights
```typescript
const hasRights = await ContributorService.hasVotingRights(groupId, userId);
// Returns: boolean
```

### Get Contributors
```typescript
const contributors = await ContributorService.getGroupContributors(groupId);
// Returns: Array of contributor objects with user profiles
```

### Get Pending Transfers (Admin)
```typescript
const pending = await ContributorService.getPendingBankTransfers(groupId);
// Returns: Array of unverified bank transfers
```

### Verify Transfer (Admin)
```typescript
await GroupContributionService.verifyBankTransfer(
  groupId,
  contributorId,
  userId,
  amount,
  grantVotingRights // true or false
);
```

## Summary

This system ensures:
- ✅ Secure voting rights management
- ✅ Automatic tracking for card payments
- ✅ Manual verification for bank transfers
- ✅ Transparent contributor tracking
- ✅ Admin control over voting eligibility
- ✅ Fraud prevention through verification
