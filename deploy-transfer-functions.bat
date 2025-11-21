@echo off
REM Deploy Transfer Edge Functions to Supabase (Windows)
REM Run this script to deploy all three transfer-related edge functions

echo.
echo 🚀 Deploying Transfer Edge Functions to Supabase...
echo.

REM Check if supabase CLI is available
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Supabase CLI not found. Please install it first:
    echo    npm install -g supabase
    exit /b 1
)

echo 📦 Deploying flutterwave-banks...
call npx supabase functions deploy flutterwave-banks
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to deploy flutterwave-banks
    exit /b 1
)
echo ✅ flutterwave-banks deployed successfully
echo.

echo 📦 Deploying flutterwave-resolve-account...
call npx supabase functions deploy flutterwave-resolve-account
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to deploy flutterwave-resolve-account
    exit /b 1
)
echo ✅ flutterwave-resolve-account deployed successfully
echo.

echo 📦 Deploying flutterwave-transfer...
call npx supabase functions deploy flutterwave-transfer
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to deploy flutterwave-transfer
    exit /b 1
)
echo ✅ flutterwave-transfer deployed successfully
echo.

echo 🎉 All transfer edge functions deployed successfully!
echo.
echo 📋 Next steps:
echo 1. Set environment variables in Supabase dashboard:
echo    - FLUTTERWAVE_SECRET_KEY
echo    - SUPABASE_URL
echo    - SUPABASE_ANON_KEY
echo.
echo 2. Update your .env file:
echo    VITE_USE_SUPABASE=true
echo.
echo 3. Test the transfer functionality
echo.
pause
