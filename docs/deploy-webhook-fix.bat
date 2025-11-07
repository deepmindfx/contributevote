@echo off
echo 🚀 Deploying Updated Webhook Function with Fixes...

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

REM Deploy Updated Webhook Function
echo 📦 Deploying webhook-contribution with improved logging and duplicate detection...

supabase functions deploy webhook-contribution --project-ref %PROJECT_REF%

if %errorlevel% equ 0 (
    echo ✅ Webhook function deployed successfully!
    echo.
    echo 🔧 Improvements deployed:
    echo - Enhanced duplicate transaction detection
    echo - Better error logging and debugging
    echo - Improved balance update tracking
    echo - Rate limiting protection
    echo.
    echo 🧪 Test your transactions now to see the improved logging in Supabase Functions logs
) else (
    echo ❌ Deployment failed. Please check your Supabase CLI setup.
)

pause