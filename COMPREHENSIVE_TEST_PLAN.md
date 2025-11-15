# Comprehensive Test Plan - Wallet Contribution System

## 🎯 Test Overview

This document outlines all tests needed to verify the complete wallet contribution system works end-to-end.

---

## 📋 Test Categories

1. **Wallet Funding** - Adding money to wallet
2. **Instant Contributions** - Contributing from wallet
3. **Scheduled Contributions** - Future one-time contributions
4. **Recurring Contributions** - Automatic repeat contributions
5. **Group Refunds** - Democratic refund voting
6. **Withdrawals** - Taking money out of wallet
7. **Voting Rights** - Access control verification
8. **Cron Jobs** - Automated processing

---

## 1️⃣ Wallet Funding Tests

### Test 1.1: Add Money via Bank Transfer
**Steps:**
1. Login to app
2. Go to Dashboard
3. Click "Add Money" or view Reserved Account
4. Note your reserved account number
5. Transfer ₦5,000 from your bank to the reserved account
6. Wait 2-5 minutes for webhook
7. Check wallet balance updates

**Expected Result:**
- ✅ Wallet balance increases by ₦5,000
- ✅ Transaction appears in wallet history
- ✅ Toast notification shows success

**SQL Verification:**
```sql
SELECT * FROM profiles WHERE id = 'YOUR_USER_ID';
-- wallet_balance should be 5000

SELECT * FROM transactions 
WHERE user_id = 'YOUR_USER_ID' 
AND type = 'deposit'
ORDER BY created_at DESC LIMIT 1;
-- Should show the deposit
```

---

## 2️⃣ Instant Contribution Tests

### Test 2.1: Contribute from Wallet (Success)
**Prerequisites:** Wallet balance ≥ ₦1,000

**Steps:**
1. Go to any group page
2. Click "Contribute to Group"
3. Enter amount: ₦1,000
4. Click "Contribute ₦1,000"
5. Verify success message

**Expected Result:**
- ✅ Wallet balance decreases by ₦1,000
- ✅ Group current_amount increases by ₦1,000
- ✅ Instant voting rights granted
- ✅ User appears in contributors list
- ✅ Toast shows success

**SQL Verification:**
```sql
-- Check wallet deducted
SELECT wallet_balance FROM profiles WHERE id = 'YOUR_USER_ID';

-- Check group increased
SELECT current_amount FROM contribution_groups WHERE id = 'GROUP_ID';

-- Check voting rights
SELECT has_voting_rights FROM contributors 
WHERE user_id = 'YOUR_USER_ID' AND group_id = 'GROUP_ID';
-- Should be true

-- Check transaction
SELECT * FROM transactions 
WHERE user_id = 'YOUR_USER_ID' 
AND contribution_id = 'GROUP_ID'
AND type = 'contribution'
ORDER BY created_at DESC LIMIT 1;
```

### Test 2.2: Contribute with Insufficient Balance (Failure)
**Prerequisites:** Wallet balance < ₦1,000

**Steps:**
1. Go to any group page
2. Click "Contribute to Group"
3. Enter amount: ₦5,000 (more than balance)
4. Try to click "Contribute"

**Expected Result:**
- ✅ Button is disabled
- ✅ Red alert shows "Insufficient balance"
- ✅ Shows how much more needed
- ✅ No contribution processed

---

## 3️⃣ Scheduled Contribution Tests

### Test 3.1: Schedule Future Contribution
**Prerequisites:** Wallet balance ≥ ₦500

**Steps:**
1. Go to any group page
2. Click "Schedule" button
3. Enter amount: ₦500
4. Select date: Tomorrow
5. Select time: 2:30 PM (use dropdowns)
6. Verify preview shows correct date/time
7. Click "Schedule Contribution"

**Expected Result:**
- ✅ Success toast appears
- ✅ Dialog closes
- ✅ Scheduled contribution saved

**SQL Verification:**
```sql
SELECT * FROM scheduled_contributions 
WHERE user_id = 'YOUR_USER_ID' 
AND group_id = 'GROUP_ID'
AND status = 'pending'
ORDER BY created_at DESC LIMIT 1;

-- Verify scheduled_date is correct
-- Verify amount is 500
```

### Test 3.2: Scheduled Contribution Processes Automatically
**Prerequisites:** Test 3.1 completed, wait until scheduled time + 15 minutes

**Steps:**
1. Wait until scheduled time passes
2. Wait up to 15 more minutes (cron runs every 15 min)
3. Check wallet balance
4. Check group balance
5. Check scheduled contribution status

**Expected Result:**
- ✅ Wallet balance decreased by ₦500
- ✅ Group balance increased by ₦500
- ✅ Scheduled contribution status = 'completed'
- ✅ Transaction created

**SQL Verification:**
```sql
-- Check status changed
SELECT status, executed_at FROM scheduled_contributions 
WHERE id = 'SCHEDULED_CONTRIBUTION_ID';
-- status should be 'completed'

-- Check transaction created
SELECT * FROM transactions 
WHERE user_id = 'YOUR_USER_ID' 
AND contribution_id = 'GROUP_ID'
AND created_at >= 'SCHEDULED_TIME'
ORDER BY created_at DESC LIMIT 1;
```

### Test 3.3: Scheduled Contribution Fails (Insufficient Balance)
**Prerequisites:** Schedule contribution for ₦5,000 but only have ₦1,000

**Steps:**
1. Schedule contribution for ₦5,000 tomorrow
2. Don't add more money
3. Wait for scheduled time + 15 minutes

**Expected Result:**
- ✅ Scheduled contribution status = 'failed'
- ✅ Wallet balance unchanged
- ✅ Group balance unchanged
- ✅ failure_reason populated

**SQL Verification:**
```sql
SELECT status, failure_reason FROM scheduled_contributions 
WHERE id = 'SCHEDULED_CONTRIBUTION_ID';
-- status should be 'failed'
-- failure_reason should mention insufficient balance
```

---

## 4️⃣ Recurring Contribution Tests

### Test 4.1: Set Up Daily Recurring Contribution
**Prerequisites:** Wallet balance ≥ ₦200

**Steps:**
1. Go to any group page
2. Click "Set Recurring" button
3. Enter amount: ₦200
4. Select frequency: Daily
5. Select start date: Today
6. Leave end date empty (no end)
7. Click "Set Up Recurring"

**Expected Result:**
- ✅ Success toast appears
- ✅ Recurring contribution saved
- ✅ next_contribution_date set to tomorrow

**SQL Verification:**
```sql
SELECT * FROM recurring_contributions 
WHERE user_id = 'YOUR_USER_ID' 
AND group_id = 'GROUP_ID'
AND is_active = true
ORDER BY created_at DESC LIMIT 1;

-- Verify frequency = 'daily'
-- Verify amount = 200
-- Verify next_contribution_date is tomorrow
```

### Test 4.2: Recurring Contribution Processes Daily
**Prerequisites:** Test 4.1 completed, wait 24 hours + 15 minutes

**Steps:**
1. Wait 24 hours
2. Wait up to 15 more minutes (cron)
3. Check wallet balance
4. Check group balance
5. Check next_contribution_date updated

**Expected Result:**
- ✅ Wallet decreased by ₦200
- ✅ Group increased by ₦200
- ✅ next_contribution_date moved to tomorrow
- ✅ total_contributions incremented
- ✅ Transaction created

**SQL Verification:**
```sql
-- Check updated
SELECT 
  next_contribution_date,
  total_contributions,
  total_amount,
  last_contribution_at
FROM recurring_contributions 
WHERE id = 'RECURRING_ID';

-- next_contribution_date should be tomorrow
-- total_contributions should be 1
-- total_amount should be 200
```

### Test 4.3: Cancel Recurring Contribution
**Steps:**
1. Find your recurring contribution
2. Click "Cancel" or update is_active to false
3. Wait for next scheduled time

**Expected Result:**
- ✅ is_active = false
- ✅ No more contributions processed
- ✅ Wallet balance unchanged after scheduled time

**SQL Verification:**
```sql
UPDATE recurring_contributions 
SET is_active = false 
WHERE id = 'RECURRING_ID';

-- Wait 24 hours, verify no new transaction created
```

---

## 5️⃣ Group Refund Tests

### Test 5.1: Request Group Refund
**Prerequisites:** 
- You contributed to a group
- You have voting rights

**Steps:**
1. Go to group page
2. Click "Request Refund" button
3. Enter reason: "Testing refund system"
4. Select refund type: Full
5. Click "Request Refund"

**Expected Result:**
- ✅ Success toast appears
- ✅ Refund request created
- ✅ Voting deadline set to 7 days from now
- ✅ RefundRequestsCard appears on page

**SQL Verification:**
```sql
SELECT * FROM group_refund_requests 
WHERE group_id = 'GROUP_ID' 
AND requester_id = 'YOUR_USER_ID'
AND status = 'pending'
ORDER BY created_at DESC LIMIT 1;

-- Verify voting_deadline is 7 days from now
-- Verify refund_type = 'full'
```

### Test 5.2: Vote on Refund Request
**Prerequisites:** Test 5.1 completed, have another user with voting rights

**Steps:**
1. Login as different user (with voting rights)
2. Go to same group page
3. See RefundRequestsCard
4. Click "Vote For" or "Vote Against"
5. Verify vote recorded

**Expected Result:**
- ✅ Vote recorded in votes JSONB
- ✅ total_votes_for or total_votes_against incremented
- ✅ User can't vote again (button disabled)
- ✅ Progress bars update

**SQL Verification:**
```sql
SELECT 
  votes,
  total_votes_for,
  total_votes_against
FROM group_refund_requests 
WHERE id = 'REFUND_REQUEST_ID';

-- Verify vote appears in votes array
-- Verify count incremented
```

### Test 5.3: Instant Refund Processing (Real-Time)
**Prerequisites:** 
- 10 contributors with voting rights
- 7 vote (70% participation)
- 5 vote "For" (71% approval)

**Steps:**
1. Have 7 users vote on refund
2. Make sure 5 vote "For", 2 vote "Against"
3. When 7th vote is cast, watch for instant processing

**Expected Result:**
- ✅ Refund processes **instantly** (no waiting!)
- ✅ Status changes to 'approved' then 'executed'
- ✅ All contributors get refunds to wallet
- ✅ Group current_amount decreases
- ✅ Refund transactions created

**SQL Verification:**
```sql
-- Check refund processed
SELECT status, executed_at, execution_details 
FROM group_refund_requests 
WHERE id = 'REFUND_REQUEST_ID';
-- status should be 'executed'

-- Check refund transactions
SELECT * FROM refund_transactions 
WHERE refund_request_id = 'REFUND_REQUEST_ID';
-- Should have one row per contributor

-- Check wallets refunded
SELECT wallet_balance FROM profiles 
WHERE id IN (SELECT user_id FROM contributors WHERE group_id = 'GROUP_ID');
-- All should have increased
```

### Test 5.4: Refund Rejected (Insufficient Votes)
**Prerequisites:**
- 10 contributors
- Only 5 vote (50% participation - below 70%)
- Wait 7 days

**Steps:**
1. Create refund request
2. Have only 5 users vote
3. Wait 7 days for deadline
4. Wait 1 hour for cron to check deadlines

**Expected Result:**
- ✅ Status changes to 'rejected'
- ✅ No refunds processed
- ✅ Wallets unchanged
- ✅ Group balance unchanged

**SQL Verification:**
```sql
SELECT status FROM group_refund_requests 
WHERE id = 'REFUND_REQUEST_ID';
-- status should be 'rejected'
```

---

## 6️⃣ Withdrawal Tests

### Test 6.1: Request Withdrawal
**Prerequisites:** Wallet balance ≥ ₦1,000

**Steps:**
1. Go to Dashboard
2. Click "Withdraw" button
3. Enter amount: ₦1,000
4. Enter bank details
5. Submit withdrawal request

**Expected Result:**
- ✅ Withdrawal request created
- ✅ Status = 'pending'
- ✅ Admin notified

**SQL Verification:**
```sql
SELECT * FROM withdrawal_requests 
WHERE user_id = 'YOUR_USER_ID' 
AND status = 'pending'
ORDER BY created_at DESC LIMIT 1;
```

### Test 6.2: Admin Approves Withdrawal
**Prerequisites:** Test 6.1 completed, admin access

**Steps:**
1. Login as admin
2. Go to admin panel
3. See pending withdrawal
4. Click "Approve"
5. Process payment externally
6. Mark as completed

**Expected Result:**
- ✅ Wallet balance decreases
- ✅ Withdrawal status = 'approved'
- ✅ Transaction created

---

## 7️⃣ Voting Rights Tests

### Test 7.1: Verify Instant Voting Rights (Wallet)
**Steps:**
1. Contribute ₦100 from wallet
2. Immediately check voting rights

**Expected Result:**
- ✅ has_voting_rights = true immediately
- ✅ Can vote on refunds
- ✅ Can see advanced options (Schedule, Recurring, Refund buttons)

**SQL Verification:**
```sql
SELECT has_voting_rights FROM contributors 
WHERE user_id = 'YOUR_USER_ID' AND group_id = 'GROUP_ID';
-- Should be true
```

### Test 7.2: Verify No Voting Rights (No Contribution)
**Steps:**
1. View a group you haven't contributed to
2. Check available actions

**Expected Result:**
- ✅ Only see "Contribute" button
- ✅ Don't see Schedule, Recurring, Refund buttons
- ✅ Can't vote on refunds
- ✅ See message about needing to contribute

---

## 8️⃣ Cron Job Tests

### Test 8.1: Verify Cron Jobs Running
**SQL Query:**
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job
ORDER BY jobid;
```

**Expected Result:**
- ✅ Job #2: process-scheduled-contributions (*/15 * * * *)
- ✅ Job #3: check-refund-deadlines (0 * * * *)
- ✅ Both active = true

### Test 8.2: Check Edge Function Logs
**Steps:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click `process-scheduled-contributions`
4. View Logs tab
5. Check recent executions

**Expected Result:**
- ✅ Function runs every 15 minutes
- ✅ No errors in logs
- ✅ Shows processed counts
- ✅ mode: 'full' or 'deadlines-only'

---

## 9️⃣ UI/UX Tests

### Test 9.1: Time Picker (AM/PM)
**Steps:**
1. Click "Schedule" button
2. Check time picker interface

**Expected Result:**
- ✅ Three dropdowns: Hours, Minutes, AM/PM
- ✅ Hours: 01-12
- ✅ Minutes: 00-59
- ✅ Period: AM/PM
- ✅ Shows "Selected: 2:30 PM" below
- ✅ Preview shows correct time

### Test 9.2: Wallet Balance Display
**Steps:**
1. Check wallet balance on dashboard
2. Check wallet balance in contribute dialog
3. Make contribution
4. Verify both update

**Expected Result:**
- ✅ Both show same balance
- ✅ Both update after contribution
- ✅ Format: ₦5,000 (with comma)

### Test 9.3: Insufficient Balance Warning
**Steps:**
1. Try to contribute more than balance
2. Check warning message

**Expected Result:**
- ✅ Red alert appears
- ✅ Shows exact amount needed
- ✅ Button disabled
- ✅ Clear messaging

---

## 🔟 Edge Cases & Error Handling

### Test 10.1: Concurrent Contributions
**Steps:**
1. Open two browser tabs
2. Try to contribute same amount from both
3. One should succeed, one should fail

**Expected Result:**
- ✅ Only one succeeds
- ✅ Database lock prevents double-spend
- ✅ Error message on failed attempt

### Test 10.2: Negative Amounts
**Steps:**
1. Try to enter negative amount
2. Try to enter 0

**Expected Result:**
- ✅ Input validation prevents negative
- ✅ Error for amounts < ₦100
- ✅ Clear error messages

### Test 10.3: Past Dates (Scheduled)
**Steps:**
1. Try to schedule for yesterday
2. Try to schedule for 1 hour ago

**Expected Result:**
- ✅ Error: "Scheduled date must be in the future"
- ✅ Can't submit
- ✅ Date picker prevents past dates

---

## 📊 Performance Tests

### Test 11.1: Load Test (Multiple Users)
**Steps:**
1. Have 10 users contribute simultaneously
2. Check database performance
3. Verify all transactions processed

**Expected Result:**
- ✅ All contributions succeed
- ✅ No race conditions
- ✅ Balances correct
- ✅ Response time < 2 seconds

### Test 11.2: Cron Job Performance
**Steps:**
1. Create 100 scheduled contributions for same time
2. Wait for cron to process
3. Check execution time

**Expected Result:**
- ✅ All processed within 1 minute
- ✅ No timeouts
- ✅ All succeed or fail gracefully

---

## ✅ Test Checklist Summary

### Critical Path (Must Pass)
- [ ] Add money to wallet
- [ ] Contribute from wallet
- [ ] Get instant voting rights
- [ ] Schedule contribution
- [ ] Scheduled contribution processes
- [ ] Set up recurring contribution
- [ ] Recurring contribution processes
- [ ] Request refund
- [ ] Vote on refund
- [ ] Instant refund processing
- [ ] Withdraw money

### Important (Should Pass)
- [ ] Insufficient balance handling
- [ ] Past date validation
- [ ] Concurrent transaction handling
- [ ] Cron jobs running
- [ ] Edge function logs clean
- [ ] UI shows correct time (AM/PM)

### Nice to Have (Good to Pass)
- [ ] Performance under load
- [ ] Error messages clear
- [ ] UI responsive
- [ ] Toast notifications work
- [ ] Real-time updates

---

## 🐛 Bug Reporting Template

When you find a bug, report it like this:

```
**Bug:** [Short description]
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** 
**Actual:** 
**SQL State:** [Run relevant query]
**Screenshots:** [If applicable]
```

---

## 📝 Test Results Log

Create a table to track results:

| Test ID | Test Name | Status | Date | Notes |
|---------|-----------|--------|------|-------|
| 1.1 | Add Money | ✅ Pass | 2025-11-15 | Worked perfectly |
| 2.1 | Instant Contribution | ✅ Pass | 2025-11-15 | Voting rights instant |
| 3.1 | Schedule Contribution | ⏳ Pending | - | Waiting to test |
| ... | ... | ... | ... | ... |

---

## 🎯 Success Criteria

System is production-ready when:
- ✅ All Critical Path tests pass
- ✅ 90%+ of Important tests pass
- ✅ No critical bugs
- ✅ Performance acceptable
- ✅ Error handling graceful
- ✅ UI/UX smooth

---

## 🚀 Ready to Test!

Start with Test 1.1 and work your way through. Good luck! 🎉

