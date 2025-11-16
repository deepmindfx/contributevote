# How to Apply Wallet Contribution Fix

## 🚨 Problem
Users report that when they contribute to groups:
- Money is NOT deducted from their wallet
- Transactions don't appear in history
- Contributions don't show up

## ✅ Solution
Apply the `APPLY_WALLET_FIX.sql` file to your Supabase database.

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: **Collectipay**
3. Click on **SQL Editor** in the left sidebar

### Step 2: Open the Fix File
1. Open the file: `APPLY_WALLET_FIX.sql`
2. Copy the ENTIRE contents (Ctrl+A, then Ctrl+C)

### Step 3: Run the SQL
1. In Supabase SQL Editor, paste the SQL (Ctrl+V)
2. Click the **RUN** button (or press Ctrl+Enter)
3. Wait for execution to complete

### Step 4: Verify Success
You should see this message:
```
✅ SUCCESS: contribute_from_wallet function created successfully!
```

If you see an error, copy the error message and share it.

---

## 🧪 Test After Applying

### Test 1: Check Function Exists
Run this in SQL Editor:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'contribute_from_wallet';
```

**Expected Result:** Should return 1 row with `contribute_from_wallet`

### Test 2: Test Contribution
1. Note your current wallet balance (e.g., ₦5,000)
2. Contribute ₦1,000 to any group
3. Check your wallet balance again
4. **Expected:** Balance should be ₦4,000

### Test 3: Check Transaction History
1. Go to Wallet History page
2. Look for the contribution transaction
3. **Expected:** Should see "Contribution to [Group Name] from wallet"

### Test 4: Check Voting Rights
1. Go to the group you contributed to
2. Look for "Can Vote" badge
3. **Expected:** Should see green badge with checkmark

---

## 🔍 Troubleshooting

### Issue: "Function already exists" error
**Solution:** The fix script handles this automatically. Just run it again.

### Issue: "Permission denied" error
**Solution:** Make sure you're logged in as the project owner or have admin access.

### Issue: Still not working after applying
**Checklist:**
1. ✅ Did you run the ENTIRE SQL file?
2. ✅ Did you see the success message?
3. ✅ Did you refresh your browser?
4. ✅ Did you clear browser cache?
5. ✅ Is your wallet balance > 0?

### Issue: Wallet balance is 0
**Solution:** You need to fund your wallet first:
1. Go to Dashboard → Wallet
2. Click "Fund Wallet"
3. Add money via Flutterwave
4. Then try contributing again

---

## 📊 What This Fix Does

The `contribute_from_wallet` function:
1. ✅ Checks if user has sufficient balance
2. ✅ Deducts money from user's wallet
3. ✅ Adds money to group's current amount
4. ✅ Creates/updates contributor record
5. ✅ Grants instant voting rights
6. ✅ Records transaction in history
7. ✅ Returns success/error message

---

## 🆘 Still Having Issues?

If the fix doesn't work:
1. Take a screenshot of any error messages
2. Check browser console (F12) for errors
3. Note the exact steps you took
4. Share all details for further debugging

---

## ✨ After Fix is Applied

Users will be able to:
- ✅ Contribute from wallet instantly
- ✅ See balance decrease immediately
- ✅ View transactions in history
- ✅ Get voting rights automatically
- ✅ Track all contributions properly

---

## 📝 Notes

- This fix is **safe** to apply multiple times
- It won't affect existing data
- All previous contributions remain intact
- Only fixes future contributions
