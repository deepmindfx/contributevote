# Quick Start: Transfer System Testing

## 🚀 Quick Setup (5 Minutes)

### Step 1: Deploy Edge Functions

**Windows:**
```bash
deploy-transfer-functions.bat
```

**Mac/Linux:**
```bash
chmod +x deploy-transfer-functions.sh
./deploy-transfer-functions.sh
```

**Or manually:**
```bash
npx supabase functions deploy flutterwave-banks
npx supabase functions deploy flutterwave-resolve-account
npx supabase functions deploy flutterwave-transfer
```

### Step 2: Set Supabase Environment Variables

Go to: https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo/settings/functions

Add these secrets:
```
FLUTTERWAVE_SECRET_KEY=FLWSECK-2c2b921fd22098c84fad569e399d29e1-19a5a828fb3vt-X
SUPABASE_URL=https://qnkezzhrhbosekxhfqzo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua2V6emhyaGJvc2VreGhmcXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzczNzEsImV4cCI6MjA3ODAxMzM3MX0.uuqw82a1m2THtHEvyZ4YYY8uDq9a8FCS-FzCq48BuxI
```

### Step 3: Verify .env File

Your `.env` should have:
```env
VITE_USE_SUPABASE=true
```
✅ Already set in your project!

### Step 4: Start Dev Server

```bash
npm run dev
```

## 🧪 Testing Options

### Option 1: Test Page (Recommended)

1. Navigate to: http://localhost:8080/test-transfer-api
2. Click "Test All" button
3. Verify both tests pass with green checkmarks

### Option 2: Transfer Form

1. Navigate to: http://localhost:8080/transfer
2. Select a bank (should load from edge function)
3. Enter account: `0690000031`
4. Bank code: `044` (Access Bank)
5. Beneficiary name should auto-populate

### Option 3: Browser Console

```javascript
// Test in browser console
import { ApiService } from '@/services/supabase/apiService';

// Test get banks
const banks = await ApiService.getBanks();
console.log(banks);

// Test resolve account
const account = await ApiService.resolveAccount('044', '0690000031');
console.log(account);
```

## 📱 Mobile Testing (Same Network)

### Step 1: Find Your Local IP

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.1.100)

**Mac:**
```bash
ifconfig | grep "inet "
```

**Linux:**
```bash
hostname -I
```

### Step 2: Access from Mobile

1. Connect phone to same WiFi
2. Open browser on phone
3. Navigate to: `http://YOUR_IP:8080/test-transfer-api`
4. Example: `http://192.168.1.100:8080/test-transfer-api`

### Step 3: Test Transfer

1. Go to: `http://YOUR_IP:8080/transfer`
2. Complete a test transfer
3. Verify it works on mobile

## ✅ Success Checklist

- [ ] Edge functions deployed
- [ ] Environment variables set in Supabase
- [ ] `VITE_USE_SUPABASE=true` in `.env`
- [ ] Dev server running
- [ ] Test page shows green checkmarks
- [ ] Banks load in transfer form
- [ ] Account validation works
- [ ] Can access from mobile

## 🔍 Troubleshooting

### Banks Not Loading

**Check:**
```bash
# Verify edge function is deployed
npx supabase functions list

# Should show: flutterwave-banks
```

**Test directly:**
```bash
curl https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-banks \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Account Validation Fails

**Check:**
- Account number is exactly 10 digits
- Bank code is correct (e.g., '044' for Access Bank)
- Flutterwave secret key is set in Supabase

**Test directly:**
```bash
curl -X POST https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-resolve-account \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account_number":"0690000031","account_bank":"044"}'
```

### Mobile Can't Connect

**Check:**
- Phone and computer on same WiFi network
- Using correct IP address
- Port 8080 not blocked by firewall

**Windows Firewall Fix:**
```bash
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=8080
```

## 📊 Expected Results

### Test Page Results

**Get Banks:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "044",
      "name": "Access Bank"
    },
    // ... more banks
  ]
}
```

**Resolve Account:**
```json
{
  "success": true,
  "data": {
    "account_number": "0690000031",
    "account_name": "JOHN DOE"
  }
}
```

## 🎯 Next Steps

Once testing is successful:

1. ✅ Test complete transfer flow
2. ✅ Verify wallet balance updates
3. ✅ Check transaction history
4. ✅ Test on mobile device
5. 🚀 Deploy to production

## 📞 Quick Commands

```bash
# Deploy all functions
deploy-transfer-functions.bat

# Start dev server
npm run dev

# Check edge functions
npx supabase functions list

# View edge function logs
npx supabase functions logs flutterwave-banks

# Find local IP (Windows)
ipconfig

# Test from command line
curl http://localhost:8080/test-transfer-api
```

## 🎉 You're Ready!

The transfer system is now using production-ready Supabase edge functions. Test thoroughly and deploy with confidence!

**Test URLs:**
- Local: http://localhost:8080/test-transfer-api
- Mobile: http://YOUR_IP:8080/test-transfer-api
- Transfer: http://localhost:8080/transfer
