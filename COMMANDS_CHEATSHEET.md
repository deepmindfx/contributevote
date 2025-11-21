# Transfer System - Command Cheatsheet

## 🚀 Quick Deploy

```bash
# Windows
deploy-transfer-functions.bat

# Mac/Linux
chmod +x deploy-transfer-functions.sh && ./deploy-transfer-functions.sh
```

## 🧪 Testing

```bash
# Start dev server
npm run dev

# Test page
http://localhost:8080/test-transfer-api

# Transfer form
http://localhost:8080/transfer
```

## 📱 Mobile Testing

```bash
# Find your IP (Windows)
ipconfig

# Find your IP (Mac)
ifconfig | grep "inet "

# Find your IP (Linux)
hostname -I

# Access from mobile (replace YOUR_IP)
http://YOUR_IP:8080/test-transfer-api
http://YOUR_IP:8080/transfer
```

## 🔧 Supabase Commands

```bash
# List edge functions
npx supabase functions list

# View logs
npx supabase functions logs flutterwave-banks
npx supabase functions logs flutterwave-resolve-account
npx supabase functions logs flutterwave-transfer

# Deploy individual function
npx supabase functions deploy flutterwave-banks
```

## 🧪 Manual API Testing

```bash
# Test get banks
curl https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-banks \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test resolve account
curl -X POST https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/flutterwave-resolve-account \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account_number":"0690000031","account_bank":"044"}'
```

## 🔥 Firewall (Windows)

```bash
# Allow port 8080
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=8080
```

## 📊 Environment Check

```bash
# Check if Supabase mode is enabled
# In browser console:
console.log(import.meta.env.VITE_USE_SUPABASE);
# Should show: "true"
```

## 🎯 Quick Verification

```bash
# 1. Deploy
deploy-transfer-functions.bat

# 2. Start
npm run dev

# 3. Test
# Open: http://localhost:8080/test-transfer-api
# Click: "Test All"
# Verify: Green checkmarks

# 4. Mobile
# Find IP: ipconfig
# Open: http://YOUR_IP:8080/test-transfer-api
```

## 📝 Environment Variables (Supabase Dashboard)

```
FLUTTERWAVE_SECRET_KEY=FLWSECK-2c2b921fd22098c84fad569e399d29e1-19a5a828fb3vt-X
SUPABASE_URL=https://qnkezzhrhbosekxhfqzo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua2V6emhyaGJvc2VreGhmcXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzczNzEsImV4cCI6MjA3ODAxMzM3MX0.uuqw82a1m2THtHEvyZ4YYY8uDq9a8FCS-FzCq48BuxI
```

## 🎉 Success Checklist

```
✅ Edge functions deployed
✅ Environment variables set
✅ npm run dev running
✅ Test page shows green checkmarks
✅ Banks load in dropdown
✅ Account validation works
✅ Can access from mobile
```

## 📚 Documentation

- Quick Start: `QUICK_START_TRANSFER_TESTING.md`
- Full Setup: `TRANSFER_EDGE_FUNCTIONS_SETUP.md`
- Complete Guide: `TRANSFER_IMPLEMENTATION_COMPLETE.md`
- This Session: `SESSION_TRANSFER_COMPLETE.md`
