@echo off
echo ========================================
echo Applying Withdrawal & Notifications Migration
echo ========================================
echo.

REM Check if .env file exists
if not exist .env (
    echo Error: .env file not found!
    echo Please create a .env file with your Supabase credentials.
    pause
    exit /b 1
)

REM Load environment variables
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="VITE_SUPABASE_URL" set SUPABASE_URL=%%b
    if "%%a"=="VITE_SUPABASE_ANON_KEY" set SUPABASE_ANON_KEY=%%b
    if "%%a"=="SUPABASE_SERVICE_ROLE_KEY" set SUPABASE_SERVICE_KEY=%%b
)

if "%SUPABASE_URL%"=="" (
    echo Error: VITE_SUPABASE_URL not found in .env
    pause
    exit /b 1
)

if "%SUPABASE_SERVICE_KEY%"=="" (
    echo Error: SUPABASE_SERVICE_ROLE_KEY not found in .env
    pause
    exit /b 1
)

echo Supabase URL: %SUPABASE_URL%
echo.

REM Apply the migration
echo Applying withdrawal and notifications migration...
echo.

curl -X POST "%SUPABASE_URL%/rest/v1/rpc/exec_sql" ^
  -H "apikey: %SUPABASE_SERVICE_KEY%" ^
  -H "Authorization: Bearer %SUPABASE_SERVICE_KEY%" ^
  -H "Content-Type: application/json" ^
  -d @supabase/migrations/create_withdrawal_and_notifications.sql

echo.
echo ========================================
echo Migration application complete!
echo ========================================
echo.
echo Next steps:
echo 1. Verify tables were created in Supabase dashboard
echo 2. Test creating a withdrawal request
echo 3. Check that notifications are sent to group members
echo.
pause
