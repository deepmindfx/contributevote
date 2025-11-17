# Withdrawal Voting System - Full Implementation

## ✅ Completed

### 1. Database Functions
- `process_approved_withdrawal()` - Processes approved withdrawals
- `check_withdrawal_voting()` - Checks voting thresholds and auto-approves/rejects
- Governance rules: 60% approval, 70% participation, 7-day deadline

### 2. Frontend Service
- Created `withdrawalService.ts` with all necessary functions:
  - `createWithdrawalRequest()` - Admin creates withdrawal
  - `voteOnWithdrawal()` - Contributors vote
  - `checkWithdrawalVoting()` - Check status
  - `getWithdrawalRequests()` - Fetch requests
  - `getUserVote()` - Get user's vote
  - `processInstantWithdrawal()` - For groups without voting

## 🔄 Next Steps (To Complete)

### A. Update WithdrawalRequest Component
**File:** `src/components/contribution/WithdrawalRequest.tsx`

**Changes Needed:**
1. Import `withdrawalService`
2. Call `checkWithdrawalVoting()` after each vote
3. Show voting progress (participation %, approval %)
4. Display threshold indicators

### B. Update Votes Page
**File:** `src/pages/Votes.tsx`

**Changes Needed:**
1. Import `withdrawalService`
2. Add progress bars for participation and approval
3. Show "Auto-approves at 70% participation + 60% approval"
4. Display countdown to deadline
5. Show current status

### C. Create Cron Job
**File:** `supabase/migrations/20250117_withdrawal_voting_cron.sql`

**Purpose:**
- Runs every hour
- Checks all pending withdrawals
- Auto-approves if thresholds met
- Auto-rejects if deadline passed

### D. Testing Guide
**File:** `WITHDRAWAL_VOTING_TEST_GUIDE.md`

**Test Scenarios:**
1. Create withdrawal request
2. Multiple users vote
3. Auto-approval when thresholds met
4. Auto-rejection after deadline
5. Wallet balance updates
6. Transaction records created

## Implementation Priority

1. **HIGH**: Update WithdrawalRequest component (voting won't work without this)
2. **HIGH**: Create cron job (auto-approval/rejection won't work)
3. **MEDIUM**: Update Votes page (better UX)
4. **LOW**: Testing guide (documentation)

## Current Status

✅ Backend functions deployed
✅ Service layer created
⏳ Frontend integration pending
⏳ Cron job pending
⏳ Testing pending

## How Voting Works

1. **Admin creates withdrawal** → 7-day deadline set
2. **Contributors vote** → Vote recorded in JSONB array
3. **After each vote** → `check_withdrawal_voting()` runs
4. **If 70% participate + 60% approve** → Auto-approves immediately
5. **If deadline passes** → Auto-rejects if thresholds not met
6. **On approval** → Group balance deducted, admin wallet credited

## Transaction Flow

```
Withdrawal Approved
    ↓
Group Balance: -₦X
    ↓
Admin Wallet: +₦X
    ↓
Transaction Record Created
    ↓
Notification Sent
```

## Next Session TODO

1. Integrate `withdrawalService` into WithdrawalRequest component
2. Add voting progress UI
3. Create and deploy cron job
4. Test end-to-end flow
5. Document any issues found
