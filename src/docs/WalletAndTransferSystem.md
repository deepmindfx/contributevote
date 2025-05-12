
# Wallet and Transfer System Documentation

This document provides an overview of the wallet and transfer system components in our application. It serves as a guide for developers who need to understand, maintain, or extend these features.

## System Overview

The wallet and transfer system consists of several interconnected components:

1. **Wallet Display** - Shows balance and wallet information
2. **Wallet Actions** - Provides options for deposits, transfers, and viewing history
3. **Transfer Form** - Handles bank transfers with multi-step process
4. **Confirmation Page** - Verifies transfer details and requires PIN authorization

## Key Components

### 1. WalletCard Component 
- **Location**: `src/components/dashboard/wallet/WalletCard.tsx`
- **Purpose**: Displays wallet balance and currency type
- **State**: Manages wallet balance and currency display
- **Key Features**: Balance display, currency toggle, copy functionality

### 2. WalletActions Component
- **Location**: `src/components/dashboard/wallet/WalletActions.tsx`
- **Purpose**: Provides action buttons for wallet operations
- **Actions**: 
  - Top Up (Deposit)
  - Send (Transfer)
  - History
- **Dialog Integration**: Contains deposit dialog with multiple methods (manual, card, bank)

### 3. TransferForm Component
- **Location**: `src/components/TransferForm.tsx`
- **Purpose**: Multi-step form for bank transfers
- **Steps**:
  1. Initial form with bank selection, amount, and recipient details
  2. Confirmation page with transfer details and PIN verification
- **Features**:
  - Bank selection from API
  - Real-time validation
  - Transfer limits (₦500,000 daily)
  - Transaction PIN verification
  - Fee calculation

### 4. Design System Integration

The wallet and transfer system uses the following design components:
- **Colors**: Primary color `#2DAE75` for buttons and highlights
- **Responsive Layout**: 
  - Mobile-first design
  - Max-width containers for desktop views (max-w-md)
  - Centered content on larger screens
- **Form Elements**: Custom styled inputs, select dropdowns with icons
- **Feedback**: Toast notifications for success/error messages

## Transaction Flow

1. **Initiate Transfer**: 
   - User clicks Send button in WalletActions
   - User is navigated to `/transfer` route

2. **Enter Transfer Details**:
   - Select bank from dropdown
   - Enter account number (10 digits)
   - Enter amount (min ₦100, max ₦500,000)
   - Enter beneficiary name
   - Optional narration
   - Click Continue

3. **Confirm Transfer**:
   - Review details (amount, recipient, bank, fee)
   - Enter 4-digit transaction PIN
   - Click Confirm to process or Cancel to edit

4. **Process Result**:
   - Success: Display confirmation toast, redirect to dashboard
   - Error: Display error message, allow retry
   - No PIN set: Redirect to settings to create PIN

## API Integration

The transfer system integrates with the following API endpoints:

1. **GET /api/banks** - Fetches available banks for transfers
2. **POST /api/transfer** - Processes the transfer with validation

## Data Flow

1. Form data is collected using React Hook Form
2. Data is validated both client-side and server-side
3. On confirmation, data is sent to the API endpoint
4. Responses update the UI with appropriate feedback

## Special Considerations

1. **Transaction PIN**: 
   - Stored in user profile
   - Required for transfer authorization
   - Users without a PIN are prompted to create one

2. **Error Handling**:
   - Network errors show toast notifications
   - Validation errors appear inline under form fields
   - PIN validation happens client-side before API call

3. **Responsive Design**:
   - Mobile: Full width, stacked layout
   - Desktop: Centered, max-width container for better readability

## Enhancement Suggestions

1. Add beneficiary management system for saved accounts
2. Implement scheduled/recurring transfers
3. Add QR code scanning for quick transfers
4. Integrate with more payment providers

## Troubleshooting Common Issues

1. **Banks not loading**: Check network connection and API endpoint availability
2. **Transfer fails**: Verify sufficient balance and valid account details
3. **PIN issues**: Ensure PIN is correctly set in user profile

This documentation should help developers understand the wallet and transfer system components and their interactions.
