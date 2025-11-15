# Quick Test Guide - Run Tests in 5 Minutes

## 🚀 How to Run Automated Tests

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo
2. Click **SQL Editor** in left sidebar
3. Click **New Query**

### Step 2: Run the Test Suite
1. Open the file: `tests/wallet-system.test.sql`
2. Copy **ALL** the content (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **Run** button

### Step 3: Read the Results
The tests will run automatically and show results like:

```
NOTICE:  === TEST 1: Wallet Contribution ===
NOTICE:  Initial wallet balance: 5000
NOTICE:  ✅ TEST 1.1 PASSED: Contribution succeeded
NOTICE:  ✅ TEST 1.2 PASSED: Wallet balance decreased correctly
NOTICE:  ✅ TEST 1.3 PASSED: Group amount increased correctly
NOTICE:  ✅ TEST 1.4 PASSED: Voting rights granted
NOTICE:  === TEST 1: ALL PASSED ===
```

---

## 📊 What Gets Tested

### ✅ Automated Tests (Run Instantly)
1. **Wallet Contribution** - Deducts from wallet, adds to group
2. **Insufficient Balance** - Rejects when not enough money
3. **Scheduled Contribution** - Creates future contribution
4. **Recurring Contribution** - Creates auto-repeat
5. **Refund Request** - Creates refund with voting
6. **Database Functions** - Verifies all functions exist
7. **Database Tables** - Verifies all tables exist
8. **Database Triggers** - Verifies triggers exist

### ⏳ Time-Based Tests (Need to Wait)
- **Scheduled Processing** - Wait 1 minute + 15 minutes
- **Recurring Processing** - Wait 24 hours + 15 minutes
- **Refund Deadline** - Wait 7 days

### 🖱️ Manual UI Tests (Test in Browser)
- **Time Picker** - Check AM/PM dropdowns work
- **Wallet Balance** - Check displays correctly
- **Contribute Button** - Check wallet-only interface
- **Voting Interface** - Check refund voting UI

---

## 🎯 Expected Results

### All Tests Should Show:
```
╔════════════════════════════════════════════════════════════╗
║           AUTOMATED TEST SUITE COMPLETED                   ║
╚════════════════════════════════════════════════════════════╝

Tests Completed:
  ✅ TEST 1: Wallet Contribution
  ✅ TEST 2: Insufficient Balance Handling
  ✅ TEST 3: Scheduled Contribution Creation
  ✅ TEST 4: Recurring Contribution Creation
  ✅ TEST 5: Refund Request Creation
  ✅ TEST 6: Refund Voting (Partial - needs manual test)
  ✅ TEST 7: Database Functions
  ✅ TEST 8: Database Tables
  ✅ TEST 9: Database Triggers
```

---

## 🐛 If Tests Fail

### Error: "table does not exist"
**Fix:** Run the wallet contribution migration first:
```sql
-- Copy content from: supabase/migrations/20250115_wallet_contribution_system.sql
-- Paste and run in SQL Editor
```

### Error: "function does not exist"
**Fix:** Same as above - run the migration

### Error: "insufficient balance"
**Fix:** This is expected for Test 2 - it's testing the error handling

---

## 🧪 Manual UI Testing (5 Minutes)

### Test 1: Time Picker
1. Go to any group page
2. Click "Schedule" button
3. Check time picker has 3 dropdowns:
   - Hours (01-12)
   - Minutes (00-59)
   - Period (AM/PM)
4. Select 2:30 PM
5. Verify it shows "Selected: 02:30 PM"

**Expected:** ✅ Clear AM/PM selection

### Test 2: Wallet Contribution
1. Go to any group page
2. Click "Contribute to Group"
3. Check interface:
   - Shows wallet balance
   - Only one payment option (wallet)
   - No card/checkout tab
4. Enter amount less than balance
5. Click contribute

**Expected:** ✅ Instant contribution, voting rights granted

### Test 3: Insufficient Balance
1. Try to contribute more than wallet balance
2. Check for red alert
3. Verify button is disabled

**Expected:** ✅ Clear error message, can't submit

### Test 4: Advanced Options
1. Contribute to a group (get voting rights)
2. Check for 3 new buttons:
   - "Set Recurring"
   - "Schedule"
   - "Request Refund"

**Expected:** ✅ All 3 buttons visible after contribution

---

## 🔍 Verify in Database

After running tests, check the data:

```sql
-- Check test users created
SELECT email, wallet_balance FROM profiles 
WHERE email LIKE 'test_%@test.com';

-- Check test group created
SELECT name, current_amount, target_amount 
FROM contribution_groups 
WHERE name LIKE 'TEST_%';

-- Check contributions recorded
SELECT * FROM contributors 
WHERE group_id IN (
  SELECT id FROM contribution_groups WHERE name LIKE 'TEST_%'
);

-- Check transactions created
SELECT type, amount, status FROM transactions 
WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE 'test_%@test.com'
)
ORDER BY created_at DESC;
```

---

## 🧹 Clean Up Test Data

After testing, remove test data:

```sql
-- Clean up test data
DELETE FROM contributors WHERE group_id IN (
  SELECT id FROM contribution_groups WHERE name LIKE 'TEST_%'
);
DELETE FROM scheduled_contributions WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE 'test_%@test.com'
);
DELETE FROM recurring_contributions WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE 'test_%@test.com'
);
DELETE FROM group_refund_requests WHERE group_id IN (
  SELECT id FROM contribution_groups WHERE name LIKE 'TEST_%'
);
DELETE FROM transactions WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE 'test_%@test.com'
);
DELETE FROM contribution_groups WHERE name LIKE 'TEST_%';
DELETE FROM profiles WHERE email LIKE 'test_%@test.com';
```

---

## ✅ Success Criteria

System is working if:
- ✅ All 9 automated tests pass
- ✅ Time picker shows AM/PM
- ✅ Wallet contribution works instantly
- ✅ Voting rights granted immediately
- ✅ Advanced options appear after contribution
- ✅ No errors in console

---

## 📞 Need Help?

If tests fail:
1. Check the error message
2. Verify migrations ran successfully
3. Check database tables exist
4. Review the SQL verification queries

Most common issue: **Migrations not run**
- Solution: Run `20250115_wallet_contribution_system.sql` first

---

## 🎉 You're Done!

Once all tests pass, your system is ready for production use!

