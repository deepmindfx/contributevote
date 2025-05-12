
# Transaction Flow

This document outlines the transaction flow in the ContributeVote application, with a focus on bank transfers and transaction history.

## Bank Transfer Flow

### 1. Transfer Form (`TransferForm.tsx`)

The transfer process begins in the `TransferForm` component, which handles:
- Bank selection
- Account number validation
- Amount input
- Transaction PIN verification
- Transfer confirmation

### 2. Transaction Saving

When a transfer is successful, the transaction is saved to localStorage with the following structure:

```typescript
interface Transaction {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
  recipientName: string;
  recipientAccount: string;
  bankName: string;
  narration?: string;
  type: 'transfer';
  userId: string;
  contributionId: string;
  description: string;
  paymentMethod: string;
  updatedAt: string;
  metaData: {
    senderName: string;
    bankName: string;
    narration: string;
    transactionReference: string;
    paymentReference: string;
  }
}
```

### 3. Transaction History Display

Transactions are displayed in two places:

1. **Wallet Card** (`WalletCard.tsx`)
   - Shows recent transactions (last 5)
   - Filters transactions by user ID and type
   - Includes deposits, withdrawals, and transfers

2. **Wallet History** (`WalletHistory.tsx`)
   - Shows all transactions
   - Allows filtering by transaction type
   - Displays detailed transaction information

## Transaction Types

The application handles three main types of transactions:

1. **Deposits**
   - Money coming into the wallet
   - Displayed with green color and down arrow
   - Includes bank transfers and card payments

2. **Withdrawals**
   - Money going out of the wallet
   - Displayed with amber color and up arrow
   - Includes bank transfers and card payments

3. **Transfers**
   - Money transferred to another bank account
   - Displayed with blue color and right arrow
   - Includes recipient details and bank information

## Transaction History Components

### TransactionHistory Component

The `TransactionHistory` component (`src/components/dashboard/wallet/TransactionHistory.tsx`) handles:
- Displaying transaction lists
- Transaction details dialog
- Date formatting
- Currency conversion
- Transaction type icons and colors

Key functions:
- `getTransactionIcon`: Returns appropriate icon based on transaction type
- `getTransactionIconColor`: Returns color scheme based on transaction type
- `getTransactionTitle`: Returns display title based on transaction type
- `formatDate`: Formats transaction dates
- `formatDateTime`: Formats transaction date and time

### WalletCard Component

The `WalletCard` component (`src/components/dashboard/wallet/WalletCard.tsx`) handles:
- Recent transactions display
- Transaction filtering
- Currency toggling
- Transaction details viewing

## Recent Changes

### 1. Transfer Transaction Integration

Added support for transfer transactions in the wallet history by:
- Updating the transaction filter in `WalletCard.tsx` to include transfer type
- Ensuring transfer transactions are saved with the correct structure
- Adding transfer-specific UI elements and styling

### 2. Transaction Structure

Standardized the transaction structure to include:
- Basic transaction details (id, amount, status)
- Recipient information for transfers
- Metadata for additional context
- Type-specific information

### 3. Navigation

Updated navigation after successful transfers to:
- Redirect to `/wallet-history` instead of `/transactions`
- Show success message
- Refresh transaction list

## Debugging Transactions

To debug transaction-related issues:

1. Check localStorage:
   ```javascript
   const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
   console.log('Transactions:', transactions);
   ```

2. Monitor console logs:
   - "Existing transactions" log
   - "New transaction to be saved" log
   - "Updated transactions in localStorage" log

3. Verify transaction structure:
   - Check for required fields
   - Verify type is set correctly
   - Ensure metadata is complete

## Common Issues and Solutions

1. **Missing Transactions**
   - Check localStorage for transaction data
   - Verify transaction type is included in filter
   - Ensure user ID matches

2. **Incorrect Display**
   - Verify transaction structure
   - Check type-specific rendering logic
   - Confirm currency conversion

3. **Navigation Issues**
   - Verify navigation path
   - Check for successful transfer response
   - Ensure proper error handling

## Future Improvements

1. Add transaction search functionality
2. Implement transaction export
3. Add transaction categories
4. Improve transaction filtering
5. Add transaction analytics 
