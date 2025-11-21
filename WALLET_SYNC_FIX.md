# Wallet Balance Sync Fix

## Issue Description
Users were experiencing an issue where money contributed from their wallet would seem to "return" to their balance after some time, or not be deducted properly.

## Root Cause
The `SyncService` (responsible for verifying wallet balances against transactions) had a logic error. It recalculated balances by summing `deposit` and `withdrawal` transactions but **ignored** `contribution`, `payment`, `transfer`, and `vote` transactions.

This caused the sync service to incorrectly calculate a higher balance than reality (ignoring the deductions) and "correct" the user's balance by adding the money back.

## Fix Applied

### 1. Updated `src/services/supabase/syncService.ts`
Modified the `syncUserData` balance calculation logic to account for ALL transaction types:
- **Add to Balance:** `deposit`, `refund`
- **Deduct from Balance:** `withdrawal`, `contribution`, `payment`, `transfer`, `vote`

### 2. Updated `src/components/contribution/ContributeButton.tsx`
- Removed the temporary `localStorage` manipulation which was causing UI inconsistencies.
- Added a call to `refreshCurrentUser()` immediately after a successful contribution to ensure the UI reflects the server's verified balance.

## Verification
1. Contribute from wallet.
2. Balance is deducted in database.
3. Sync service runs (automatically or manually).
4. Balance remains deducted because the sync service now properly accounts for the `contribution` transaction.

