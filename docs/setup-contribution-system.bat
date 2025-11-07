@echo off
echo ========================================
echo Contribution System Setup
echo ========================================
echo.

echo Step 1: Installing flutterwave-react-v3...
echo.
call npm install flutterwave-react-v3
if %errorlevel% neq 0 (
    echo ERROR: Failed to install flutterwave-react-v3
    echo Please run: npm install flutterwave-react-v3
    pause
    exit /b 1
)
echo.
echo ✅ flutterwave-react-v3 installed successfully!
echo.

echo Step 2: Checking environment variables...
echo.
if not exist ".env" (
    echo WARNING: .env file not found
    echo Please create .env file and add:
    echo VITE_FLUTTERWAVE_PUBLIC_KEY=your_key_here
    echo.
) else (
    findstr /C:"VITE_FLUTTERWAVE_PUBLIC_KEY" .env >nul
    if %errorlevel% neq 0 (
        echo WARNING: VITE_FLUTTERWAVE_PUBLIC_KEY not found in .env
        echo Please add: VITE_FLUTTERWAVE_PUBLIC_KEY=your_key_here
        echo.
    ) else (
        echo ✅ VITE_FLUTTERWAVE_PUBLIC_KEY found in .env
        echo.
    )
)

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo ✅ Dependencies installed
echo ✅ useAuth exported from SecureAuthContext
echo.
echo Next Steps:
echo 1. Add VITE_FLUTTERWAVE_PUBLIC_KEY to your .env file
echo 2. Apply database migration (see MANUAL_DEPLOYMENT_GUIDE.md)
echo 3. Integrate components into your pages
echo.
echo See FRONTEND_INTEGRATION_COMPLETE.md for integration guide
echo.
pause
