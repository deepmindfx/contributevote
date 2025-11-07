# 🔗 Automatic Webhook System Setup

## ✅ **Webhook Function Updated & Deployed**

Your webhook function has been updated to handle:
- ✅ **Virtual account credits** (bank transfers)
- ✅ **Card payments** (online payments)
- ✅ **Contribution group payments**
- ✅ **Automatic balance updates**

## 🔧 **Flutterwave Dashboard Setup**

### **Step 1: Configure Webhook URL**
1. **Go to**: [Flutterwave Dashboard](https://dashboard.flutterwave.com/settings/webhooks)
2. **Add Webhook URL**: 
   ```
   https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution
   ```

### **Step 2: Select Events**
Enable these webhook events:
- ✅ **`charge.completed`** - When card payments succeed
- ✅ **`transfer.completed`** - When bank transfers complete
- ✅ **`charge.failed`** - When payments fail (optional)

### **Step 3: Test the Webhook**
1. **Save the webhook configuration**
2. **Use Flutterwave's test webhook feature**
3. **Check Supabase Edge Function logs** for webhook activity

## 🎯 **How It Works**

### **Virtual Account Transfers:**
```
Bank Transfer → Flutterwave → Webhook → Supabase → Balance Update
```

1. User sends money to virtual account (8817986351)
2. Flutterwave receives the transfer
3. Flutterwave sends webhook to your Edge Function
4. Edge Function finds user by account number
5. Creates transaction record in database
6. Updates user's wallet balance
7. User sees updated balance in app

### **Card Payments:**
```
Card Payment → Flutterwave → Webhook → Supabase → Balance Update
```

1. User makes card payment
2. Flutterwave processes payment
3. Webhook sent with user email
4. Edge Function finds user by email
5. Transaction recorded and balance updated

## 🧪 **Testing the System**

### **Test 1: Virtual Account Transfer**
1. **Send money** to your virtual account: **8817986351 (Sterling Bank)**
2. **Wait 1-2 minutes** for Flutterwave to process
3. **Check your app** - balance should update automatically
4. **Check Supabase logs** - webhook should show activity

### **Test 2: Card Payment**
1. **Create a payment invoice** in your app
2. **Complete the payment** with test card
3. **Balance should update** immediately after payment

### **Test 3: Webhook Logs**
1. **Go to**: Supabase Dashboard → Edge Functions → webhook-contribution
2. **Click "Logs"** to see webhook activity
3. **Look for**: "Virtual account credited" or "Payment processed"

## 🔍 **Troubleshooting**

### **If Balance Doesn't Update:**
1. **Check Flutterwave webhook logs** - was webhook sent?
2. **Check Supabase Edge Function logs** - any errors?
3. **Verify webhook URL** is correct in Flutterwave
4. **Check account number** matches your virtual account

### **Common Issues:**
- **Wrong webhook URL** - Must be exact Supabase function URL
- **Missing events** - Ensure `transfer.completed` is enabled
- **Account mismatch** - Virtual account number must match exactly
- **Duplicate transactions** - Webhook handles duplicates automatically

## 📊 **Webhook Data Flow**

### **Flutterwave Webhook Payload:**
```json
{
  "event": "transfer.completed",
  "data": {
    "account_number": "8817986351",
    "amount": 1000,
    "sender_name": "John Doe",
    "sender_bank": "GTBank",
    "payment_reference": "FLW_REF_123",
    "transaction_reference": "TXN_456"
  }
}
```

### **What Happens:**
1. **Find User** - Search profiles for matching virtual account
2. **Check Duplicates** - Prevent duplicate transactions
3. **Create Transaction** - Add to transactions table
4. **Update Balance** - Add amount to wallet_balance
5. **Log Success** - Record in Edge Function logs

## 🎉 **Benefits of Automatic Webhooks**

- ✅ **Instant Updates** - Balance updates within seconds
- ✅ **No Manual Work** - Completely automatic
- ✅ **Duplicate Prevention** - Handles duplicate webhooks
- ✅ **Full Audit Trail** - All transactions recorded
- ✅ **Real-time Sync** - Database always up-to-date

## 🔐 **Security Features**

- ✅ **Webhook Validation** - Verifies Flutterwave signatures
- ✅ **Duplicate Prevention** - Reference ID checking
- ✅ **Error Handling** - Graceful failure handling
- ✅ **Audit Logging** - Complete transaction history

## 🚀 **Next Steps**

1. **Configure webhook in Flutterwave Dashboard**
2. **Test with a small transfer** to your virtual account
3. **Verify balance updates automatically**
4. **Remove manual transaction button** (no longer needed)

**Your automatic webhook system is now live!** 🎊