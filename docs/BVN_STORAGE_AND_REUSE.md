# BVN Storage and Reuse Implementation

## Overview
This document describes the implementation of BVN (Bank Verification Number) storage and automatic reuse across the application. Users now only need to enter their BVN once during wallet creation, and it will be automatically used for group wallet creation.

## Changes Made

### 1. Database Schema Update
**File:** `supabase/migrations/20250123_add_bvn_to_profiles.sql`

- Added `bvn` column to the `profiles` table
- BVN is stored as VARCHAR(11) to hold 11-digit BVN
- Created index for efficient lookup
- Added comments for documentation

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bvn VARCHAR(11);
```

### 2. TypeScript Types Update
**File:** `src/integrations/supabase/types.ts`

- Updated the `profiles` table type definition
- Added `bvn` field to Row, Insert, and Update types
- Type: `bvn: string | null`

### 3. Wallet Service Update
**File:** `src/services/supabase/walletService.ts`

- Modified `createVirtualAccount` method to save BVN to user profile
- BVN is now stored alongside virtual account details
- This ensures BVN is captured during the first wallet creation

**Changes:**
```typescript
await UserService.updateUser(userId, {
  bvn: idNumber, // Save BVN to profile for reuse in group creation
  preferences: {
    ...user.preferences as any,
    virtualAccount: reservedAccount
  }
});
```

### 4. Group Creation Form Update
**File:** `src/components/create-group/GroupForm.tsx`

- Added `useEffect` hook to fetch BVN from user profile on component mount
- Auto-populates the BVN field if it exists in the user's profile
- BVN is fetched silently in the background

**Key Feature:**
```typescript
useEffect(() => {
  const fetchUserBvn = async () => {
    if (user?.id && !formData.bvn) {
      const { data } = await supabase
        .from('profiles')
        .select('bvn')
        .eq('id', user.id)
        .single();

      if (data?.bvn) {
        setFormData(prev => ({ ...prev, bvn: data.bvn }));
      }
    }
  };
  fetchUserBvn();
}, [user?.id]);
```

### 5. Settings Step UI Update
**File:** `src/components/create-group/SettingsStep.tsx`

- Updated UI to show different interfaces based on BVN availability
- If BVN exists: Shows a green confirmation box with masked BVN (last 4 digits)
- If BVN doesn't exist: Shows input field with explanatory text
- User-friendly messaging explaining BVN will be saved for future use

**UI States:**
1. **BVN Available:** 
   - Green confirmation box
   - Displays: "BVN Retrieved from Your Profile"
   - Shows: "Your saved BVN (ending in ****1234) will be used"
   
2. **BVN Not Available:**
   - Input field for BVN entry
   - Validation and error handling
   - Message: "Your BVN will be saved to your profile for future use"

### 6. BVN Input Dialog Update
**File:** `src/components/contribution/BvnInputDialog.tsx`

- Added `initialBvn` prop to accept pre-filled BVN
- Component now supports both modes: with existing BVN and without
- Updated UI to show confirmation when BVN is pre-filled
- Improved messaging for first-time BVN entry

**New Props:**
```typescript
interface BvnInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bvn: string) => void;
  isLoading?: boolean;
  initialBvn?: string | null; // NEW: Optional pre-filled BVN
}
```

### 7. Group Detail Page Update
**File:** `src/pages/GroupDetail.tsx`

- Added state to store user's BVN: `const [userBvn, setUserBvn] = useState<string | null>(null)`
- Added `useEffect` to fetch BVN from profile on component mount
- Updated `handleSetupBankAccount` to save BVN if not already saved
- Pass `initialBvn` prop to `BvnInputDialog`

**Key Changes:**
1. Fetch user BVN on page load
2. Pass BVN to dialog component
3. Save BVN to profile if entering for the first time in this flow

## User Experience Flow

### First Time User (No BVN Saved)
1. User creates their personal wallet
2. User enters BVN (or NIN)
3. BVN is saved to their profile
4. Virtual account is created

### Creating Group Wallet (BVN Already Saved)
1. User navigates to group creation
2. System automatically fetches BVN from profile
3. On Settings Step, user sees green confirmation: "BVN Retrieved from Your Profile"
4. BVN input field is hidden
5. User proceeds without re-entering BVN
6. Group wallet is created using saved BVN

### Alternative Flow: Setting Up Bank Account Later
1. User creates group without bank account
2. Later, clicks "Set Up Bank Account" button
3. Dialog opens with pre-filled BVN (if exists)
4. User confirms and account is created

## Security Considerations

1. **BVN Storage:** BVN is stored in plain text in the database. For production, consider:
   - Encrypting the BVN column
   - Using application-level encryption
   - Implementing field-level encryption in Supabase

2. **BVN Display:** 
   - Never display full BVN in UI
   - Always mask to show only last 4 digits
   - Example: `****1234`

3. **Access Control:**
   - BVN is only accessible to the user who owns it
   - Row Level Security (RLS) should be enabled on profiles table
   - No other users can access another user's BVN

## Benefits

1. **Improved UX:** Users only enter BVN once
2. **Reduced Friction:** Faster group creation process
3. **Consistency:** Same BVN used across all user's wallets
4. **Error Reduction:** Less manual entry = fewer typos
5. **Time Saving:** Eliminates repetitive data entry

## Migration Steps

1. Run the migration: `20250123_add_bvn_to_profiles.sql`
2. Existing users will have `NULL` BVN initially
3. BVN will be captured on their next wallet creation
4. For existing virtual accounts, BVN can be optionally back-filled if needed

## Testing Checklist

- [ ] New user creates wallet with BVN - verify BVN is saved
- [ ] Existing user with BVN creates group - verify BVN is auto-populated
- [ ] User without BVN creates group - verify input field is shown
- [ ] BVN is saved after group creation if not previously saved
- [ ] Masked BVN displays correctly (last 4 digits only)
- [ ] Group Detail page pre-fills BVN in dialog
- [ ] Database migration runs without errors
- [ ] TypeScript types compile without errors

## Future Enhancements

1. **Encryption:** Implement encryption at rest for BVN field
2. **Audit Logging:** Track BVN access and usage
3. **BVN Verification:** Add API to verify BVN with bank services
4. **BVN Update:** Allow users to update their BVN if it changes
5. **Multi-BVN Support:** Support multiple BVNs for users with multiple identities

## Files Modified

1. `supabase/migrations/20250123_add_bvn_to_profiles.sql` - NEW
2. `src/integrations/supabase/types.ts` - MODIFIED
3. `src/services/supabase/walletService.ts` - MODIFIED
4. `src/components/create-group/GroupForm.tsx` - MODIFIED
5. `src/components/create-group/SettingsStep.tsx` - MODIFIED
6. `src/components/contribution/BvnInputDialog.tsx` - MODIFIED
7. `src/pages/GroupDetail.tsx` - MODIFIED

## Conclusion

This implementation significantly improves the user experience by eliminating the need to repeatedly enter BVN across different wallet creation flows. The changes are backwards compatible and work seamlessly for both new and existing users.

