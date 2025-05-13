# Groups and Payment System Documentation

This document provides a detailed overview of the group contribution system and associated payment flows in our application. It serves as a reference for developers working with these components.

## System Overview

The group contribution system is a feature that allows users to create and manage group savings or contributions. Key components include:

1. **Group Creation** - Users can create new contribution groups with various settings
2. **Contribution Management** - Adding funds to groups and tracking progress
3. **Payment Processing** - Multiple payment methods for contributing to groups
4. **Withdrawal Handling** - Group creators can withdraw accumulated funds

## Key Components

### 1. Group Creation Flow

- **Location**: `src/components/create-group/GroupForm.tsx`
- **Purpose**: Multi-step form for creating new contribution groups
- **Steps**:
  1. Details Step (`DetailsStep.tsx`) - Basic information like name, description, target amount
  2. Schedule Step (`ScheduleStep.tsx`) - Contribution frequency, amount, start/end dates
  3. Settings Step (`SettingsStep.tsx`) - Privacy settings, contribution limits, etc.
- **State Management**: Uses local state with React's `useState` to track form data across steps

### 2. Group Detail Display

- **Location**: `src/components/group-detail/GroupDetailContent.tsx`
- **Purpose**: Displays comprehensive information about a specific group
- **Key Features**:
  - Group header with progress indicators
  - Wallet status and progress tracking
  - Contributors list
  - Transaction history
  - Withdrawal requests (for group creators)

### 3. Group Wallet Component

- **Location**: `src/components/group-detail/GroupWallet.tsx`
- **Purpose**: Displays and manages the financial aspects of a group
- **Subcomponents**:
  - `WalletHeader.tsx` - Shows balance and key metrics
  - `WalletProgress.tsx` - Visual indicator of progress toward goal
  - `WalletActions.tsx` - Buttons for contributing and withdrawing funds
  - `WalletDetails.tsx` - Additional financial information

### 4. Contribution Mechanisms

The system supports multiple ways to contribute to groups:

1. **Wallet Transfer**: 
   - Direct transfer from user's wallet to group wallet
   - Implemented in `ContributeDialog.tsx`
   - Uses the user's existing wallet balance

2. **Card/Bank Payment**:
   - External payment via Monnify integration
   - Implemented in `MonnifyAmountDialog.tsx` and `payWithMonnify` utility
   - Supports bank transfers and card payments

3. **Anonymous Contributions**:
   - Option to contribute without revealing identity
   - Tracked separately in contribution records

### 5. Payment Processing

The payment flow involves several components:

- **Payment Initiation**:
  - Located in `src/components/group-detail/wallet/WalletActions.tsx`
  - Handles initial payment request setup
  - Provides payment method selection

- **Payment Processing**:
  - Payment gateway integration via `src/utils/monnifyPayment.ts`
  - Handles API calls to payment provider
  - Manages callbacks and transaction status updates

- **Transaction Recording**:
  - Updates local storage with transaction records
  - Reflects changes in user and group balances
  - Located in `src/services/localStorage/transactionOperations.ts`

### 6. Withdrawal Handling

Group creators can withdraw funds using the withdrawal system:

- **Request Creation**: 
  - Located in `WithdrawalRequestDialog.tsx`
  - Validates withdrawal amounts against group balance

- **Request Processing**:
  - Requires approval workflow (for multi-member groups)
  - Updates group balance when approved
  - Located in `src/services/localStorage/withdrawalOperations.ts`

## Data Flow

1. **Group Creation**:
   ```
   User Input → GroupForm → Flutterwave Virtual Account Creation → Group Creation → Dashboard Display
   ```

2. **Contribution Flow**:
   ```
   User selects amount → Payment method selection → Payment processing → 
   Transaction recorded → Group balance updated → UI reflects changes
   ```

3. **Withdrawal Flow**:
   ```
   Creator requests withdrawal → Validation → Approval (if needed) → 
   Funds transferred → Transaction recorded → Balances updated
   ```

## Integration Points

### 1. Wallet Integration

The group system integrates with the user wallet system:
- Shares balance information
- Uses same transaction recording mechanisms
- Affects the same user account balance

### 2. Payment Gateway Integration

The Flutterwave payment integration:
- Configured in `src/services/flutterwave/`
- Uses API keys stored in environment variables
- Handles callbacks via configured webhook endpoints
- Provides virtual accounts for both users and groups

### 3. User Profile Integration

The group system connects with user profiles:
- Groups track creator and contributor information
- User dashboard shows associated groups
- Notifications system alerts users about group activities

## Adding New Features

When implementing new features for the groups system, consider these integration points:

### 1. Adding a New Contribution Method

1. Create a new dialog component in `src/components/group-detail/dialogs/`
2. Add the new payment method option in `WalletActions.tsx`
3. Implement the payment processing logic, ensuring it:
   - Updates transaction records
   - Updates group and user balances
   - Provides appropriate user feedback

### 2. Extending Group Features

1. Modify the appropriate step in the group creation flow
2. Update the GroupDetailContent to display the new feature
3. Update the localStorage operations in `contributionOperations.ts`
4. Update any related types in `types.ts`

### 3. Adding Analytics or Reporting

1. Create new analytics components in `src/components/analytics/`
2. Implement data collection in relevant operations
3. Add visualization components for the collected data

## Virtual Account System

The platform uses Flutterwave's virtual account system for both user wallets and group accounts:

### User Virtual Accounts
- Created when a user first sets up their wallet
- Requires BVN verification
- Used for receiving deposits and contributions

### Group Virtual Accounts
- Created during group creation
- Requires creator's BVN verification
- Used for receiving group contributions
- Managed by the group creator

### Account Management
- Virtual accounts are permanent
- Each account has a unique account number
- Transactions are automatically tracked and reconciled
- Webhooks handle transaction notifications

## Security Considerations

1. **BVN Verification**
   - Required for all virtual accounts
   - Used for identity verification
   - Stored securely and masked in logs

2. **Transaction Security**
   - All transactions are logged
   - Webhook verification for transaction status
   - Automatic reconciliation of payments

3. **Access Control**
   - Group creators manage their group accounts
   - Contributors can only view their own transactions
   - Withdrawals require group approval

## Error Handling

1. **Account Creation Errors**
   - Invalid BVN
   - Duplicate accounts
   - API failures

2. **Transaction Errors**
   - Failed payments
   - Network issues
   - Invalid amounts

3. **Recovery Procedures**
   - Automatic retries for failed API calls
   - Manual intervention for critical errors
   - Transaction status verification

## Future Improvements

1. **Enhanced Analytics**
   - Transaction patterns
   - Group performance metrics
   - User behavior analysis

2. **Additional Payment Methods**
   - Card payments
   - USSD
   - Mobile money

3. **Automated Reconciliation**
   - Real-time balance updates
   - Automated dispute resolution
   - Enhanced error recovery

## Best Practices

1. **State Management**:
   - Use the `useContribution` hook for accessing contribution context
   - Leverage the helper functions in `contributionOperations.ts`

2. **UI Consistency**:
   - Follow the established pattern of cards with headers and content sections
   - Use the same color scheme (primary: `#2DAE75`)
   - Maintain consistent spacing and typography

3. **Error Handling**:
   - Validate inputs before processing
   - Provide clear error messages via toast notifications
   - Handle payment failures gracefully

4. **Performance**:
   - Minimize localStorage operations
   - Use the `refreshData` function from AppContext to ensure data consistency

## Troubleshooting Common Issues

1. **Group not showing in dashboard**: 
   - Ensure proper creation with valid ID
   - Check user association with the group

2. **Payment not processing**:
   - Verify payment gateway configuration
   - Check console for API call errors
   - Ensure sufficient wallet balance for transfers

3. **Balance inconsistencies**:
   - Use `refreshData()` to synchronize state
   - Check transaction records for proper recording
   - Verify withdrawal operations completed successfully

This documentation should help developers understand the group and payment system architecture and implement new features effectively.
