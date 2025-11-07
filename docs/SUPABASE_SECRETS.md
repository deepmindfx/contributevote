# 🔐 Supabase Secrets Configuration

## Required Secrets for Edge Functions

Go to your Supabase Dashboard → Settings → Edge Functions → Environment Variables and add these:

### Production Secrets (Recommended)
```bash
FLUTTERWAVE_SECRET_KEY=FLWSECK-1a801e703afaa2c13acdf4c3777637a0-196bacad06fvt-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-8e8ffa9525113016e99fd89b74340fc0-X
FLUTTERWAVE_ENCRYPTION_KEY=1a801e703afa763a4e28a736
FLUTTERWAVE_SECRET_HASH=MySuperSecretHashForCollectiPay#!
```

### Test Secrets (For Development)
```bash
FLUTTERWAVE_SECRET_KEY_TEST=FLWSECK-85d93895f84a5bd92b7fbad3e211fd76-1965a626b3cvt-X
FLUTTERWAVE_PUBLIC_KEY_TEST=FLWPUBK-c8219c2937991e7d7db1652def38e630-X
FLUTTERWAVE_ENCRYPTION_KEY_TEST=85d93895f84a288eebd6f33c
```

### Additional Required Secrets
```bash
SUPABASE_URL=https://qnkezzhrhbosekxhfqzo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[Get this from Supabase Dashboard → Settings → API]
```

## How to Set Secrets

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: CollectiPay
3. **Navigate to**: Settings → Edge Functions
4. **Add Environment Variables**: Copy the secrets above
5. **Save**: Click "Save" after adding each secret

## ⚠️ Important Notes

- Use **Production secrets** for live transactions
- Use **Test secrets** for development/testing
- Keep secrets secure and never commit to version control
- Edge Functions will automatically use these secrets

## Verification

After setting secrets, your Edge Functions will be able to:
- ✅ Fetch Nigerian banks from Flutterwave
- ✅ Resolve bank account details
- ✅ Process bank transfers
- ✅ Handle payment webhooks

Your Edge Functions are already deployed and waiting for these secrets!