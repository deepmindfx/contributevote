# Manual Testing Guide - 10 Minutes

This guide walks you through testing the wallet contribution system by actually using the app. No SQL needed!

---

## 🎯 What We're Testing

1. ✅ Add money to wallet
2. ✅ Contribute from wallet
3. ✅ Progress bar updates
4. ✅ Voting rights granted
5. ✅ Schedule contribution
6. ✅ Set recurring contribution
7. ✅ Request refund
8. ✅ Logout works

---

## 📋 Prerequisites

- ✅ App is running (npm run dev)
- ✅ You have a user account
- ✅ At least one group exists

---

## Test 1: Add Money to Wallet (2 minutes)

### Steps:
1. **Login** to your app
2. Go to **Dashboard**
3. Look for your **wallet balance** (should show ₦0 or current amount)
4. Find your **Reserved Account Number** (usually displayed on dashboard)
5. **Transfer money** from your bank to this account number
   - Amount: ₦5,000 (or any amount)
   - Use your bank app or USSD
6. **Wait 2-5 minutes** for webhook to process
7. **Refresh** the dashboard page

### ✅ Success Criteria:
- Wallet balance increases by the amount you transferred
- You see a transaction in wallet history
- Toast notification appears (if you're on the page)

### 🐛 If It Fails:
- Check Supabase logs for webhook errors
- Verify reserved account number is correct
- Wait a bit longer (sometimes takes 5 minutes)

---

## Test 2: Contribute from Wallet (1 minute)

### Steps:
1. Go to any **group page**
2. Click **"Contribute to Group"** button
3. Check the dialog:
   - ✅ Shows your wallet balance
   - ✅ Only shows wallet option (no card tab)
   - ✅ Shows benefits (instant voting rights, no fees)
4. Enter amount: **₦1,000**
5. Click **"Contribute ₦1,000"**
6. Wait for page to reload

### ✅ Success Criteria:
- Success toast appears
- Page reloads automatically
- Wallet balance decreased by ₦1,000
- Group progress bar updated
- You appear in contributors list
- You see "Set Recurring", "Schedule", "Request Refund" buttons (voting rights!)

### 🐛 If It Fails:
- Check browser console for errors
- Verify wallet had enough balance
- Check if page reloaded (should happen automatically)

---

## Test 3: Progress Bar Updates (30 seconds)

### Steps:
1. Note the **current progress** on group page
2. Note the **current amount** (e.g., ₦5,000 / ₦10,000)
3. Contribute ₦1,000 (from Test 2)
4. After page reloads, check progress bar

### ✅ Success Criteria:
- Progress bar moved forward
- Current amount increased by ₦1,000
- Percentage updated correctly
- Shows on both:
  - Group detail page
  - Dashboard group list

### 🐛 If It Fails:
- Refresh the page manually
- Check if contribution actually went through
- Look at database: `SELECT current_amount FROM contribution_groups WHERE id = 'GROUP_ID';`

---

## Test 4: Voting Rights (30 seconds)

### Steps:
1. After contributing (Test 2), check for these buttons:
   - **"Set Recurring"**
   - **"Schedule"**
   - **"Request Refund"**
2. Try clicking each button to verify they open

### ✅ Success Criteria:
- All 3 buttons visible
- Buttons open their respective dialogs
- Dialogs show correct group name

### 🐛 If It Fails:
- Check if contribution was successful
- Verify in database: `SELECT has_voting_rights FROM contributors WHERE user_id = 'YOUR_ID' AND group_id = 'GROUP_ID';`
- Should be `true`

---

## Test 5: Schedule Contribution (1 minute)

### Steps:
1. Click **"Schedule"** button
2. Check the dialog:
   - ✅ Amount input
   - ✅ Date picker
   - ✅ Time picker with 3 dropdowns (Hours, Minutes, AM/PM)
3. Fill in:
   - Amount: **₦500**
   - Date: **Tomorrow**
   - Time: **2:30 PM** (use dropdowns)
4. Verify preview shows:
   - Correct date (e.g., "Friday, November 16, 2025")
   - Correct time (e.g., "2:30 PM")
   - Days until (e.g., "In 1 day")
5. Click **"Schedule Contribution"**

### ✅ Success Criteria:
- Success toast appears
- Dialog closes
- Scheduled contribution saved
- Will process tomorrow at 2:30 PM (within 15 minutes)

### 🐛 If It Fails:
- Check if wallet has ₦500
- Verify time picker shows AM/PM
- Check browser console for errors

---

## Test 6: Set Recurring Contribution (1 minute)

### Steps:
1. Click **"Set Recurring"** button
2. Fill in:
   - Amount: **₦200**
   - Frequency: **Daily**
   - Start date: **Today**
   - End date: **Leave empty** (no end)
3. Check preview shows:
   - Next contribution date
   - Frequency summary
4. Click **"Set Up Recurring"**

### ✅ Success Criteria:
- Success toast appears
- Dialog closes
- Recurring contribution saved
- Will process daily at midnight (within 15 minutes)

### 🐛 If It Fails:
- Check if wallet has ₦200
- Verify frequency dropdown works
- Check browser console for errors

---

## Test 7: Request Refund (1 minute)

### Steps:
1. Click **"Request Refund"** button
2. Fill in:
   - Reason: **"Testing refund system"**
   - Type: **Full refund**
3. Read the governance rules:
   - 60% approval needed
   - 70% participation needed
   - 7 days voting period
4. Click **"Request Refund"**

### ✅ Success Criteria:
- Success toast appears
- Dialog closes
- **Refund Requests Card** appears on page
- Shows:
  - Your refund request
  - Voting progress bars
  - "Vote For" / "Vote Against" buttons (for other users)
  - Days remaining

### 🐛 If It Fails:
- Check if you have voting rights
- Verify you contributed to this group
- Check browser console for errors

---

## Test 8: Logout (30 seconds)

### Steps:
1. Click your **profile icon** (top right)
2. Click **"Logout"**
3. Wait for redirect

### ✅ Success Criteria:
- Redirected to home page
- Can't access dashboard (try going to /dashboard)
- Need to login again
- Wallet balance cleared from UI

### 🐛 If It Fails:
- Check browser console for errors
- Try clearing cookies and cache
- Verify Supabase auth is working

---

## Test 9: Time Picker AM/PM (30 seconds)

### Steps:
1. Click **"Schedule"** button
2. Look at the time picker
3. Check for **3 separate dropdowns**:
   - Hours (01-12)
   - Minutes (00-59)
   - Period (AM/PM)
4. Select: **2:30 PM**
5. Verify it shows: **"Selected: 02:30 PM"**

### ✅ Success Criteria:
- Three dropdowns visible
- Can select AM or PM
- Shows selected time in 12-hour format
- Preview shows correct time

### 🐛 If It Fails:
- Check if component loaded correctly
- Refresh the page
- Check browser console for errors

---

## Test 10: Wallet Balance Display (30 seconds)

### Steps:
1. Check wallet balance on **Dashboard**
2. Click **"Contribute to Group"**
3. Check wallet balance in **dialog**
4. Verify both show **same amount**
5. Contribute ₦100
6. After reload, verify both **decreased by ₦100**

### ✅ Success Criteria:
- Dashboard and dialog show same balance
- Both update after contribution
- Format: ₦5,000 (with comma)
- Real-time accuracy

### 🐛 If It Fails:
- Refresh the page
- Check if contribution went through
- Verify database: `SELECT wallet_balance FROM profiles WHERE id = 'YOUR_ID';`

---

## 📊 Test Results Checklist

Mark each test as you complete it:

- [ ] Test 1: Add Money to Wallet
- [ ] Test 2: Contribute from Wallet
- [ ] Test 3: Progress Bar Updates
- [ ] Test 4: Voting Rights
- [ ] Test 5: Schedule Contribution
- [ ] Test 6: Set Recurring Contribution
- [ ] Test 7: Request Refund
- [ ] Test 8: Logout
- [ ] Test 9: Time Picker AM/PM
- [ ] Test 10: Wallet Balance Display

---

## 🎉 All Tests Passed?

If all 10 tests passed, your system is **production-ready**! 🚀

### What's Working:
- ✅ Wallet funding via bank transfer
- ✅ Instant wallet contributions
- ✅ Real-time progress updates
- ✅ Instant voting rights
- ✅ Scheduled contributions
- ✅ Recurring contributions
- ✅ Group refunds with voting
- ✅ Proper logout
- ✅ AM/PM time picker
- ✅ Accurate balance display

---

## 🐛 Common Issues & Fixes

### Issue: Wallet balance not updating
**Fix:** Wait 5 minutes, check webhook logs, verify account number

### Issue: Progress bar not updating
**Fix:** Refresh page, check if contribution succeeded

### Issue: Voting rights not granted
**Fix:** Check database, verify contribution completed

### Issue: Scheduled contribution not processing
**Fix:** Wait 15 minutes after scheduled time, check cron job logs

### Issue: Logout not working
**Fix:** Clear cookies, check Supabase auth session

---

## 📝 Notes

- **Scheduled contributions** process within 15 minutes of scheduled time
- **Recurring contributions** process daily at midnight (within 15 minutes)
- **Refund voting** processes instantly when thresholds met
- **Page reloads** after contribution to ensure fresh data

---

## 🎯 Quick Verification (1 Minute)

If you just want to verify the system works:

1. ✅ Login
2. ✅ Check wallet balance shows
3. ✅ Go to a group
4. ✅ Click "Contribute to Group"
5. ✅ See wallet-only interface
6. ✅ Contribute ₦100
7. ✅ Page reloads
8. ✅ Progress bar updated
9. ✅ See 3 new buttons (Schedule, Recurring, Refund)
10. ✅ Logout works

**All good?** You're ready to go! 🎉

