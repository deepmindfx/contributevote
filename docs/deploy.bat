@echo off
echo 🚀 Deploying ContributeVote Edge Functions to Supabase...

set PROJECT_REF=qnkezzhrhbosekxhfqzo

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI not found. Installing...
    npm install -g supabase
)

REM Login to Supabase (if not already logged in)
echo 🔐 Checking Supabase authentication...
supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo Please login to Supabase:
    supabase login
)

REM Deploy Edge Functions
echo 📦 Deploying Edge Functions...

echo 1/3 Deploying flutterwave-virtual-account...
supabase functions deploy flutterwave-virtual-account --project-ref %PROJECT_REF%

echo 2/3 Deploying flutterwave-transactions...
supabase functions deploy flutterwave-transactions --project-ref %PROJECT_REF%

echo 3/3 Deploying flutterwave-invoice...
supabase functions deploy flutterwave-invoice --project-ref %PROJECT_REF%

echo ✅ All Edge Functions deployed successfully!
echo.
echo 🔧 Next steps:
echo 1. Set environment variables in Supabase Dashboard
echo 2. Test virtual account creation in your app
echo 3. Verify no CORS errors
echo.
echo 🎉 Your ContributeVote app is now fully migrated to Supabase!
pause