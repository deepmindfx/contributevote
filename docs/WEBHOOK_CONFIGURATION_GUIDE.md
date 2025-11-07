# Flutterwave Webhook Configuration Guide

## Your Webhook URL

```
https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution
```

## Setup Steps

### 1. Login to Flutterwave Dashboard
Go to: https://dashboard.flutterwave.com/

### 2. Navigate to Webhooks Settings
- Click on **Settings** in the sidebar
- Select **Webhooks**

### 3. Add Webhook URL
- Click **Add Webhook**
- Enter the webhook URL: `https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution`
- Select events to listen to:
  - ✅ `charge.completed` (for card payments)
  - ✅ `transfer.completed` (for bank transfers)

### 4. Save Secret Hash
Flutterwave will provide a **Secret Hash** - this is already in your `.env` file:
```
VITE_FLW_SECRET_HASH=MySuperSecretHashForCollectiPay#!
```

### 5. Test the Webhook
After configuration, make a test payment and check:
- Flutterwave Dashboard > Webhooks > View Logs
- Your Supabase Edge Function logs

## How It Works

### Card/Online Payments (Automatic Voting Rights)
1. User pays via Flutterwave
2. Payment completes
3. Flutterwave sends `charge.completed` webhook
4. Webhook checks for `group_id` in payment metadata
5. If found, creates contributor record with `has_voting_rights: true`
6. Updates group's `current_amount`
7. User gets voting rights immediately ✅

### Bank Transfers (Manual Verification Required)
1. User transfers to group's account
2. Flutterwave sends `transfer.completed` webhook
3. Webhook creates contributor record with `has_voting_rights: false`
4. Admin must manually verify and grant voting rights
5. Updates group's `current_amount`

## Webhook Payload Example

When a contribution payment is made, Flutterwave sends:

```json
{
  "event": "charge.completed",
  "data": {
    "id": 1234567,
    "tx_ref": "GROUP_4afb715c-bece-4252-9b7f-e996c05dc959_1762518562367",
    "flw_ref": "IRPG8690176251864430621195",
    "amount": 1000,
    "currency": "NGN",
    "status": "successful",
    "payment_type": "card",
    "customer": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "meta": {
      "group_id": "4afb715c-bece-4252-9b7f-e996c05dc959",
      "user_id": "35121734-87ef-4f7d-9936-a055b3037855",
      "contribution_type": "group"
    }
  }
}
```

## Troubleshooting

### Webhook Not Receiving Events
1. Check Flutterwave Dashboard > Webhooks > Logs
2. Verify webhook URL is correct
3. Check Supabase Edge Function logs
4. Ensure `verify_jwt: false` for webhook function (already set)

### Contributions Not Recording
1. Check if `group_id` is in payment metadata
2. Verify user email matches a profile in database
3. Check Supabase logs for errors
4. Verify RLS policies allow inserts

### Testing Locally
Webhooks don't work on localhost. Options:
1. Use ngrok to expose localhost
2. Deploy to production and test there
3. Use Flutterwave's webhook testing tool

## Current Status

✅ Webhook function deployed
✅ Webhook handles group contributions
✅ Automatic voting rights for card payments
✅ Manual verification for bank transfers
⏳ **Action Required:** Configure webhook URL in Flutterwave Dashboard

## Next Steps

1. Configure webhook URL in Flutterwave (see steps above)
2. Make a test payment
3. Verify contribution is recorded
4. Check voting rights are granted
5. Monitor webhook logs for any issues
