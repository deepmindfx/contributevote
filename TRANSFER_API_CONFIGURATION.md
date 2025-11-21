# Transfer API Configuration Analysis

## Current Status: ⚠️ NEEDS ATTENTION

The transfer system is using **static API endpoints** that only work in development.

## Current Implementation

### TransferForm.tsx
```typescript
// Currently using static endpoints
const response = await fetch('/api/banks');
const response = await fetch('/api/resolve-account?...');
const response = await fetch('/api/transfer', {...});
```

### Vite Proxy (Development Only)
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    secure: false,
  }
}
```

**Problem**: This proxy only works in development. In production, `/api/*` calls will fail.

## Available Solution: ApiService

There's already a proper service layer in `src/services/supabase/apiService.ts`:

### ApiService Features

1. **Dual Mode Support**:
   - Supabase Edge Functions (production-ready)
   - Legacy API (localhost:5000 for development)

2. **Environment Variable Control**:
   - `VITE_USE_SUPABASE=true` → Uses Supabase Edge Functions
   - `VITE_USE_SUPABASE=false` → Uses localhost:5000

3. **Available Methods**:
   - `ApiService.getBanks()`
   - `ApiService.resolveAccount(bankCode, accountNumber)`
   - `ApiService.processTransfer(transferData)`
   - `ApiService.simulateContributionTransfer(...)`

## Required Supabase Edge Functions

For production, you need these edge functions:

1. **flutterwave-banks** - Get list of Nigerian banks
2. **flutterwave-resolve-account** - Validate account and get beneficiary name
3. **flutterwave-transfer** - Process bank transfer

## Recommended Fix

### Option 1: Use ApiService (Recommended)

Update `TransferForm.tsx` to use the existing `ApiService`:

```typescript
import { ApiService } from '@/services/supabase/apiService';

// Replace:
const response = await fetch('/api/banks');
const data = await response.json();

// With:
const data = await ApiService.getBanks();

// Replace:
const response = await fetch(`/api/resolve-account?bankCode=${bankCode}&accountNumber=${accountNumber}`);
const data = await response.json();

// With:
const data = await ApiService.resolveAccount(bankCode, accountNumber);

// Replace:
const response = await fetch('/api/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transferData)
});
const result = await response.json();

// With:
const result = await ApiService.processTransfer(transferData);
```

### Option 2: Create Vercel Serverless Functions

If you want to keep the `/api/*` approach, create Vercel serverless functions:

```
/api/
  ├── banks.ts
  ├── resolve-account.ts
  └── transfer.ts
```

### Option 3: Deploy Backend Server

Deploy the localhost:5000 backend to a production server and update the proxy target.

## Environment Variables Needed

Add to `.env`:

```env
# Use Supabase Edge Functions (recommended for production)
VITE_USE_SUPABASE=true

# Supabase URL (already exists)
VITE_SUPABASE_URL=https://qnkezzhrhbosekxhfqzo.supabase.co

# Flutterwave API Keys (for edge functions)
VITE_FLW_PUBLIC_KEY=your_public_key
VITE_FLW_SECRET_KEY=your_secret_key
```

## Implementation Steps

### Step 1: Check if Edge Functions Exist

Check if these Supabase edge functions are deployed:
- `flutterwave-banks`
- `flutterwave-resolve-account`
- `flutterwave-transfer`

### Step 2: Update TransferForm

Replace static fetch calls with `ApiService` methods.

### Step 3: Set Environment Variable

```env
VITE_USE_SUPABASE=true
```

### Step 4: Test

1. Test in development
2. Test in production build
3. Verify transfers work end-to-end

## Current Edge Functions Status

Let me check what edge functions exist...

Based on the codebase, I can see:
- ✅ `flutterwave-virtual-account` - exists
- ✅ `flutterwave-transactions` - exists
- ✅ `flutterwave-invoice` - exists
- ✅ `webhook-contribution` - exists
- ❓ `flutterwave-banks` - need to check
- ❓ `flutterwave-resolve-account` - need to check
- ❓ `flutterwave-transfer` - need to check

## Next Steps

1. **Verify** which edge functions exist in Supabase
2. **Create missing** edge functions if needed
3. **Update** TransferForm to use ApiService
4. **Test** the transfer flow
5. **Deploy** and verify in production

## Benefits of Using ApiService

✅ Works in both development and production
✅ Easy to switch between Supabase and legacy API
✅ Centralized error handling
✅ Type-safe with TypeScript
✅ Consistent API across the app
✅ No proxy configuration needed

## Conclusion

The transfer system is functional in development but needs to be updated to use `ApiService` for production deployment. This is a straightforward refactor that will make the system production-ready.
