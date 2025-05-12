# Development Guide

This guide provides information for developers working on the ContributeVote project.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd contributevote
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── components/         # React components
│   ├── dashboard/     # Dashboard-related components
│   ├── ui/           # Reusable UI components
│   └── ...
├── contexts/         # React contexts
├── docs/            # Documentation
├── hooks/           # Custom React hooks
├── integrations/    # Third-party integrations
├── lib/            # Utility libraries
├── pages/          # Page components
├── services/       # API services
├── styles/         # Global styles
└── types/          # TypeScript type definitions
```

## Key Components

### Wallet System

The wallet system consists of several key components:

1. **WalletCard** (`components/dashboard/wallet/WalletCard.tsx`)
   - Main wallet interface
   - Handles balance display
   - Manages transactions

2. **TransferForm** (`components/TransferForm.tsx`)
   - Handles bank transfers
   - Validates accounts
   - Processes transactions

3. **TransactionHistory** (`components/dashboard/wallet/TransactionHistory.tsx`)
   - Displays transaction history
   - Manages transaction details
   - Handles filtering and sorting

## State Management

The application uses React Context for state management:

1. **AppContext** (`contexts/AppContext.tsx`)
   - Manages global application state
   - Handles user data
   - Manages transactions

2. **Local Storage**
   - Stores transactions
   - Caches user preferences
   - Maintains session data

## Working with Transactions

### Adding New Transaction Types

1. Update the transaction interface:
   ```typescript
   interface Transaction {
     // ... existing fields ...
     type: 'deposit' | 'withdrawal' | 'transfer' | 'new-type';
   }
   ```

2. Add type-specific UI elements:
   ```typescript
   const getTransactionIcon = (type: string) => {
     switch (type) {
       // ... existing cases ...
       case 'new-type':
         return <NewIcon />;
     }
   };
   ```

3. Update transaction filters:
   ```typescript
   const filteredTransactions = transactions.filter(t => 
     t.type === 'new-type' || // Add new type
     // ... existing conditions ...
   );
   ```

### Debugging Transactions

1. Check localStorage:
   ```javascript
   const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
   console.log('Transactions:', transactions);
   ```

2. Monitor network requests:
   - Use browser dev tools
   - Check API responses
   - Verify request payloads

3. Test transaction flow:
   - Create test transactions
   - Verify storage
   - Check display

## Styling Guidelines

1. Use Tailwind CSS classes
2. Follow the existing color scheme:
   - Primary: `#2DAE75` (green)
   - Secondary: `#F5F5F5` (light gray)
   - Text: `#1F2937` (dark gray)

3. Component-specific styles:
   - Use CSS modules for complex components
   - Keep styles close to components
   - Follow BEM naming convention

## Testing

1. Unit Tests:
   ```bash
   npm run test
   ```

2. Component Tests:
   ```bash
   npm run test:components
   ```

3. E2E Tests:
   ```bash
   npm run test:e2e
   ```

## Best Practices

1. **Code Organization**
   - Keep components small and focused
   - Use TypeScript interfaces
   - Follow consistent naming

2. **State Management**
   - Use context for global state
   - Keep local state minimal
   - Avoid prop drilling

3. **Performance**
   - Memoize expensive calculations
   - Use React.memo for pure components
   - Optimize re-renders

4. **Error Handling**
   - Use try-catch blocks
   - Show user-friendly errors
   - Log errors properly

## Common Tasks

### Adding a New Feature

1. Create feature branch:
   ```bash
   git checkout -b feature/new-feature
   ```

2. Implement changes:
   - Add components
   - Update types
   - Add tests

3. Test changes:
   ```bash
   npm run test
   ```

4. Create pull request:
   - Add description
   - Link related issues
   - Request review

### Fixing Bugs

1. Reproduce the issue
2. Add test case
3. Fix the bug
4. Verify the fix
5. Update documentation

## Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Test the build:
   ```bash
   npm run preview
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create pull request

## Resources

- [React Documentation](https://reactjs.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vite Documentation](https://vitejs.dev/) 