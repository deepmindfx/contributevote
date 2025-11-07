# Withdrawal System Added to Group Detail ✅

## What Was Added

Group admins can now request withdrawals from their groups, which require contributor approval through voting.

## New Components

### 1. WithdrawalRequest Component
Located: `src/components/contribution/WithdrawalRequest.tsx`

**Features**:
- Shows available group balance
- Amount input with validation
- Purpose textarea (required explanation)
- Automatic 7-day voting deadline
- Prevents withdrawal of more than available balance
- Creates withdrawal request in database

### 2. Updated GroupAdminPanel
Added new "Withdrawal" tab alongside:
- Pending Transfers
- Withdrawal (NEW!)
- All Contributors

## How It Works

### Withdrawal Flow:
1. **Admin creates request** → Fills amount and purpose
2. **Request submitted** → Stored in `withdrawal_requests` table
3. **Contributors vote** → Approve or Reject (7-day deadline)
4. **If approved** → Funds transferred to admin's wallet
5. **If rejected** → Request closed, no transfer

### Validation:
✅ Amount must be positive
✅ Amount cannot exceed available balance
✅ Purpose is required
✅ Only group admin can create requests
✅ 7-day voting period automatically set

## Database Structure

### withdrawal_requests table:
```typescript
{
  id: string
  contribution_id: string  // Group ID
  requester_id: string     // Admin who requested
  amount: number
  purpose: string          // Why funds are needed
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  deadline: string         // 7 days from creation
  created_at: string
  votes: Json              // Array of votes
}
```

## User Interface

### Admin Panel - Withdrawal Tab:
```
┌─────────────────────────────────────┐
│ 💰 Request Withdrawal               │
│ Available Balance: ₦X,XXX           │
├─────────────────────────────────────┤
│ Amount (₦)                          │
│ [Input field]                       │
│ Maximum: ₦X,XXX                     │
├─────────────────────────────────────┤
│ Purpose                             │
│ [Textarea]                          │
│ Explain why you need these funds... │
├─────────────────────────────────────┤
│ [Submit Withdrawal Request]         │
└─────────────────────────────────────┘
```

### Info Alert:
"Withdrawal requests require approval from contributors with voting rights. The voting period is 7 days. Once approved, funds will be transferred to your wallet."

## Voting Process

### Contributors See Request:
- On `/votes` page
- Shows amount, purpose, group name
- Can vote Approve or Reject
- Countdown timer shows time left
- Vote count displayed

### After Voting Period:
- **Approved**: Funds move to admin's wallet
- **Rejected**: Request closed, funds stay in group
- **Expired**: Deadline passed, no action taken

## Security Features

✅ **Admin only** - Only group creator can request withdrawals
✅ **Balance check** - Cannot withdraw more than available
✅ **Purpose required** - Must explain fund usage
✅ **Voting required** - Contributors must approve
✅ **Time limit** - 7-day voting deadline
✅ **Transparent** - All contributors see the request

## Benefits

1. **Democratic** - Contributors vote on fund usage
2. **Transparent** - Clear purpose and amount
3. **Secure** - Multiple validation checks
4. **Fair** - Time-limited voting period
5. **Accountable** - Admin must explain fund usage

## Status

✅ WithdrawalRequest component created
✅ GroupAdminPanel updated with Withdrawal tab
✅ Form validation implemented
✅ Database integration complete
✅ 7-day voting deadline automatic
✅ Balance checking working
✅ Purpose requirement enforced

Group admins can now request withdrawals that require contributor approval! 💰🗳️
