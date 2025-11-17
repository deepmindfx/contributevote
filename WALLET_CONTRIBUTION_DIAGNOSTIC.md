# Wallet Contribution Issue - Diagnostic Report

## Issue Description
User reports: "Money is deducted from wallet when contributing to a group, but after sometime, the money is returned to the wallet"

## Investigation Results

### 1. Database Function Analysis ✅
The `contribute_from_wallet()` function is working correctly:
- Deducts from user's `wallet_balance` in profiles table
- Adds to group's `current_amount`
- Creates contributor record with voting rights
- Creates transaction record
- Uses row locking to prevent race conditions

### 2. Refund System Check ✅
- No automatic refund requests found in database
- No refund transactions found
- Refund trigger only fires when votes are cast on refund requests
- No evidence of automatic refunds

### 3. Cron Job Analysis ✅
The cron job (`process-scheduled-contributions`) only processes:
- Recurring contributions (scheduled future contributions)
- Scheduled contributions (one-time future contributions)
- Refund voting deadlines (only for pending refund requests)

**It does NOT reverse or refund wallet contributions**

### 4. Webhook Analysis ✅
The webhook (`webhook-contribution`) handles:
- Flutterwave card payments
- Bank transfers to virtual accounts
- Does NOT process or reverse wallet contributions

### 5. Transaction History Check ✅
Checked user `7f1db04a-71af-4459-8694-dee8bcd9c103`:
- 3 wallet contributions of ₦100 each (total ₦300 deducted)
- Current balance: ₦100
- No refund transactions found
- All transactions show status: "completed"

## Possible Causes

### A. Frontend Display Issue (Most Likely)
The issue might be a **frontend caching or state management problem**:

1. **React State Not Updating**: The wallet balance might be cached in React state
2. **Supabase Realtime Lag**: Balance updates might not be reflected immediately
3. **Multiple Tab Sync**: If user has multiple tabs open, old state might override new state
4. **Local Storage**: Old balance might be cached in localStorage

### B. Race Condition (Less Likely)
If user clicks contribute button multiple times rapidly:
- First click: Deducts money ✅
- Second click: Might fail due to insufficient balance
- Frontend might show confusing state

### C. Browser Back/Forward (Possible)
If user navigates back after contributing:
- Browser might show cached page with old balance
- Refreshing would show correct balance

## Recommended Fixes

### Fix 1: Force Balance Refresh After Contribution
Update `ContributeButton` or wallet contribution service to force a balance refresh:

```typescript
// After successful contribution
await refreshContributionData(); // Already exists
await supabase.auth.refreshSession(); // Force session refresh
window.location.reload(); // Nuclear option - force full reload
```

### Fix 2: Add Realtime Subscription to Wallet Balance
Subscribe to profile changes to update balance in real-time:

```typescript
// In useSupabaseUser or similar
useEffect(() => {
  const channel = supabase
    .channel('profile-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${user.id}`
    }, (payload) => {
      // Update local state with new wallet_balance
      setUser(prev => ({
        ...prev,
        wallet_balance: payload.new.wallet_balance
      }));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user.id]);
```

### Fix 3: Add Transaction Verification
Show transaction history immediately after contribution to prove money was deducted:

```typescript
// After contribution success
toast.success('Contribution successful!', {
  description: `New balance: ₦${result.new_balance}`,
  action: {
    label: 'View Transaction',
    onClick: () => navigate('/wallet-history')
  }
});
```

### Fix 4: Add Optimistic Updates
Update UI immediately, then sync with database:

```typescript
// Before API call
setOptimisticBalance(currentBalance - amount);

// After API call
if (success) {
  setActualBalance(result.new_balance);
} else {
  // Revert optimistic update
  setOptimisticBalance(currentBalance);
}
```

## Next Steps

1. **Ask User for More Details**:
   - How long is "after sometime"? (seconds, minutes, hours?)
   - Does refreshing the page show the correct balance?
   - Is this happening on every contribution or randomly?
   - Are they using multiple tabs/devices?

2. **Check Frontend Code**:
   - Review `useSupabaseUser` context
   - Check if wallet_balance is being cached
   - Look for any code that might reset the balance

3. **Add Logging**:
   - Log balance before and after contribution
   - Log all balance updates
   - Track when balance changes occur

4. **Test Scenario**:
   - Contribute from wallet
   - Immediately check database balance
   - Wait 5 minutes, check again
   - Check if frontend matches database

## Database Queries for Testing

```sql
-- Check user's current balance
SELECT id, name, email, wallet_balance, updated_at
FROM profiles
WHERE id = 'USER_ID';

-- Check user's recent transactions
SELECT id, type, amount, description, status, created_at
FROM transactions
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 20;

-- Check if any refunds exist
SELECT * FROM transactions
WHERE user_id = 'USER_ID' AND type = 'refund';

-- Check group balance
SELECT id, name, current_amount, updated_at
FROM contribution_groups
WHERE id = 'GROUP_ID';
```

## Conclusion

**No evidence of automatic refunds or reversals in the database.**

The issue is most likely a **frontend display/caching problem** rather than a database issue. The money is NOT being returned in the database - it's staying deducted as expected.

Recommended immediate action: Add real-time balance updates and force refresh after contributions.
