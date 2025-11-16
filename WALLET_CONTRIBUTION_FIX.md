# Wallet Contribution Issues & Fixes

## 🚨 Critical Issues Reported

### 1. Money Not Being Deducted from Wallet
**Problem:** When users contribute, money isn't deducted from their wallet and transactions aren't recorded.

**Root Cause:** The `contribute_from_wallet` database function exists in the migration file but may not have been applied to the production database.

**Solution:**
```sql
-- Run this migration on your Supabase database
-- File: supabase/migrations/20250115_wallet_contribution_system.sql
```

The migration includes:
- `contribute_from_wallet()` function - Handles wallet deductions
- `contributors` table updates - Tracks contributions
- `transactions` table inserts - Records all transactions
- Instant voting rights grant

### 2. Bank Card Not Visible to Some Users
**Problem:** Some users can't see the shareable bank card.

**Possible Causes:**
1. Group doesn't have `account_number` field populated
2. User doesn't have permission to view the group
3. Component rendering issue

**Solution:** Check if group has account details:
```typescript
// In GroupDetail.tsx, the card only shows if:
{group.account_number && (
  <ShareableBankCard ... />
)}
```

### 3. Share as Image Feature Missing
**Problem:** Users want to share bank details as an image, not just text.

**Solution:** We need to add html2canvas library to convert the card to an image.

---

## 🔧 Immediate Fixes Needed

### Fix 1: Verify Migration Applied

**Check if function exists:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'contribute_from_wallet';
```

**If not found, apply migration:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the contents of `supabase/migrations/20250115_wallet_contribution_system.sql`

### Fix 2: Add Image Sharing

Install html2canvas:
```bash
npm install html2canvas
```

Update ShareableBankCard to include:
- Download as Image button
- Share as Image option
- Beautiful branded design for social media

### Fix 3: Debug Bank Card Visibility

Add logging to check:
```typescript
console.log('Group account number:', group.account_number);
console.log('Group bank name:', group.bank_name);
```

---

## 📊 Testing Checklist

After applying fixes:

- [ ] User contributes ₦1000 from wallet
- [ ] Wallet balance decreases by ₦1000
- [ ] Transaction appears in wallet history
- [ ] Group current_amount increases by ₦1000
- [ ] User gets voting rights immediately
- [ ] Contributor count increases
- [ ] Bank card is visible to all group members
- [ ] Share as text works (WhatsApp, Twitter, Facebook)
- [ ] Share as image works (download + share)

---

## 🎯 Next Steps

1. **Apply Migration** - Run the wallet contribution migration on production
2. **Add Image Sharing** - Implement html2canvas for image export
3. **Test Thoroughly** - Verify all wallet operations work
4. **Monitor Transactions** - Check that all contributions are recorded

---

## 💡 Prevention

To prevent this in the future:
1. Always verify migrations are applied to production
2. Add migration status checks in the app
3. Include transaction logging for debugging
4. Add user-facing error messages with details
