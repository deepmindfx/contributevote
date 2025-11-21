# Transfer Static API - Findings & Solution

## 🔍 What I Found

Yes! The **TransferForm** is using **static API endpoints** instead of the proper service layer.

### Current Implementation

**File**: `src/components/TransferForm.tsx`

```typescript
// Line 94: Fetching banks
const response = await fetch('/api/banks');

// Line 137: Resolving account
const response = await fetch(`/api/resolve-account?bankCode=${bankCode}&accountNumber=${accountNumber}`);

// Line 282: Processing transfer
const response = await fetch('/api/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transferData)
});
```

### How It Works Now

**Development**: 
- Vite proxy routes `/api/*` → `http://localhost:5000`
- Requires a local backend server running on port 5000

**Production**: 
- ❌ **BROKEN** - No proxy, no backend, calls will fail

## 📦 Available Solution

There's already a proper `ApiService` in the codebase!

**File**: `src/services/supabase/apiService.ts`

### ApiService Architecture

```typescript
// Main service with environment-based switching
export class ApiService {
  private static useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';
  
  static async getBanks() { ... }
  static async resolveAccount(bankCode, accountNumber) { ... }
  static async processTransfer(transferData) { ... }
}

// Supabase Edge Functions implementation
export class SupabaseApiService {
  static async getBanks() {
    return supabase.functions.invoke('flutterwave-banks', { method: 'GET' });
  }
  // ... other methods
}

// Legacy localhost:5000 implementation
export class LegacyApiService {
  private static baseUrl = 'http://localhost:5000/api';
  // ... methods
}
```

## ❌ Missing Edge Functions

**Existing Edge Functions**:
- ✅ `flutterwave-virtual-account`
- ✅ `flutterwave-transactions`
- ✅ `flutterwave-invoice`
- ✅ `webhook-contribution`
- ✅ `process-scheduled-contributions`

**Missing Edge Functions** (needed for transfers):
- ❌ `flutterwave-banks`
- ❌ `flutterwave-resolve-account`
- ❌ `flutterwave-transfer`

## 🛠️ Solution Options

### Option 1: Create Missing Edge Functions (Recommended)

Create three new Supabase edge functions:

1. **flutterwave-banks**
   - Fetches list of Nigerian banks from Flutterwave
   - Returns bank codes and names

2. **flutterwave-resolve-account**
   - Validates bank account number
   - Returns beneficiary name
   - Uses Flutterwave account resolution API

3. **flutterwave-transfer**
   - Processes bank transfer
   - Deducts from user wallet
   - Creates transaction record
   - Calls Flutterwave transfer API

### Option 2: Use Vercel Serverless Functions

Create API routes in `/api` folder:
- `/api/banks.ts`
- `/api/resolve-account.ts`
- `/api/transfer.ts`

### Option 3: Deploy Backend Server

Deploy the localhost:5000 backend to production and update configs.

## 🎯 Recommended Implementation

### Step 1: Create Edge Functions

I can help you create the three missing edge functions based on the existing patterns in your codebase.

### Step 2: Update TransferForm

Replace static fetch calls with ApiService:

```typescript
// Before
const response = await fetch('/api/banks');
const data = await response.json();

// After
import { ApiService } from '@/services/supabase/apiService';
const data = await ApiService.getBanks();
```

### Step 3: Set Environment Variable

```env
VITE_USE_SUPABASE=true
```

### Step 4: Test & Deploy

## 📊 Impact Analysis

**Files to Update**:
- `src/components/TransferForm.tsx` (main changes)

**New Files to Create**:
- `supabase/functions/flutterwave-banks/index.ts`
- `supabase/functions/flutterwave-resolve-account/index.ts`
- `supabase/functions/flutterwave-transfer/index.ts`

**Benefits**:
- ✅ Works in production
- ✅ No backend server needed
- ✅ Consistent with existing architecture
- ✅ Uses existing ApiService pattern
- ✅ Environment-based configuration

## 🚀 Next Steps

Would you like me to:

1. **Create the three missing edge functions**?
2. **Update TransferForm to use ApiService**?
3. **Both** (complete the migration)?

Let me know and I'll implement the solution!
