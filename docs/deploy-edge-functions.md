# 🚀 Edge Functions Deployment Guide

## Required Edge Functions

We need to deploy these 3 additional Edge Functions to complete the wallet functionality:

### 1. flutterwave-virtual-account
**Purpose**: Create virtual accounts for users
**File**: `supabase/functions/flutterwave-virtual-account/index.ts`

### 2. flutterwave-transactions  
**Purpose**: Get virtual account transactions
**File**: `supabase/functions/flutterwave-transactions/index.ts`

### 3. flutterwave-invoice
**Purpose**: Create payment invoices
**File**: `supabase/functions/flutterwave-invoice/index.ts`

## Deployment Methods

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Deploy the functions**:
   ```bash
   supabase functions deploy flutterwave-virtual-account --project-ref qnkezzhrhbosekxhfqzo
   supabase functions deploy flutterwave-transactions --project-ref qnkezzhrhbosekxhfqzo
   supabase functions deploy flutterwave-invoice --project-ref qnkezzhrhbosekxhfqzo
   ```

### Option 2: Manual Deployment via Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo)
2. Navigate to **Edge Functions**
3. Click **Create Function**
4. Copy the code from each function file
5. Deploy each function

## Environment Variables Required

Make sure these are set in Supabase Dashboard → Settings → Edge Functions:

```bash
FLUTTERWAVE_SECRET_KEY=your_flutterwave_secret_key
FLUTTERWAVE_PUBLIC_KEY=your_flutterwave_public_key
FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key
```

## Testing the Functions

After deployment, test each function:

### Test Virtual Account Creation:
```bash
curl -X POST https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-virtual-account \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "tx_ref": "TEST_123",
    "bvn": "12345678901",
    "narration": "Test virtual account"
  }'
```

### Test Transaction Fetching:
```bash
curl -X POST https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-transactions \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "account_reference": "YOUR_ACCOUNT_REFERENCE"
  }'
```

### Test Invoice Creation:
```bash
curl -X POST https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-invoice \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "paymentReference": "INV_123",
    "paymentDescription": "Test payment",
    "currencyCode": "NGN",
    "contractCode": "465595618981",
    "redirectUrl": "https://yourapp.com/dashboard"
  }'
```

## Verification

Once deployed, the virtual account creation should work without CORS errors. The app will use these Edge Functions instead of making direct API calls to Flutterwave.

## Next Steps

1. Deploy the functions using one of the methods above
2. Test virtual account creation in the app
3. Verify that transactions are fetched properly
4. Test payment invoice creation

The CORS error will be resolved once these Edge Functions are deployed and the app uses them instead of direct API calls.