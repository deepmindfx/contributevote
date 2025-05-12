# Component Documentation

This document provides detailed information about the key components in the ContributeVote application.

## Wallet Components

### WalletCard

**Location**: `src/components/dashboard/wallet/WalletCard.tsx`

**Purpose**: Main wallet interface component that displays balance and recent transactions.

**Key Features**:
- Balance display with currency toggle
- Recent transactions list
- Transaction filtering
- Navigation to full transaction history

**Props**:
```typescript
interface WalletCardProps {
  balance: number;
  currency: 'NGN' | 'USD';
  transactions: Transaction[];
  onCurrencyToggle: () => void;
  onViewAll: () => void;
}
```

**Usage Example**:
```tsx
<WalletCard
  balance={1000}
  currency="NGN"
  transactions={transactions}
  onCurrencyToggle={handleCurrencyToggle}
  onViewAll={handleViewAll}
/>
```

### TransferForm

**Location**: `src/components/TransferForm.tsx`

**Purpose**: Handles bank transfer functionality including account validation and transaction processing.

**Key Features**:
- Bank selection
- Account number validation
- Amount input
- PIN verification
- Transaction confirmation

**State Management**:
```typescript
interface TransferFormState {
  selectedBank: string;
  accountNumber: string;
  amount: number;
  pin: string;
  isLoading: boolean;
  isValidating: boolean;
  validationError: string | null;
}
```

**Key Functions**:
- `handleBankSelect`: Manages bank selection
- `validateAccount`: Validates recipient account
- `handleConfirmTransfer`: Processes the transfer
- `saveTransactionToHistory`: Saves transaction to localStorage

### TransactionHistory

**Location**: `src/components/dashboard/wallet/TransactionHistory.tsx`

**Purpose**: Displays and manages transaction history with filtering and sorting capabilities.

**Key Features**:
- Transaction list display
- Filtering by type and date
- Sorting options
- Transaction details view
- Currency toggle

**Props**:
```typescript
interface TransactionHistoryProps {
  transactions: Transaction[];
  currency: 'NGN' | 'USD';
  onCurrencyToggle: () => void;
  onTransactionClick: (transaction: Transaction) => void;
}
```

## UI Components

### Button

**Location**: `src/components/ui/Button.tsx`

**Purpose**: Reusable button component with various styles and states.

**Variants**:
- Primary
- Secondary
- Outline
- Text

**Props**:
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'text';
  size: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### Input

**Location**: `src/components/ui/Input.tsx`

**Purpose**: Reusable input component with validation and error states.

**Features**:
- Label support
- Error messages
- Required field indication
- Custom validation

**Props**:
```typescript
interface InputProps {
  label: string;
  type: string;
  value: string;
  error?: string;
  required?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}
```

## Layout Components

### DashboardLayout

**Location**: `src/components/layout/DashboardLayout.tsx`

**Purpose**: Main layout component for dashboard pages.

**Features**:
- Navigation sidebar
- Header with user info
- Content area
- Responsive design

**Props**:
```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
}
```

## Component Interactions

### Transaction Flow

1. **Transfer Initiation**:
   ```mermaid
   graph TD
     A[TransferForm] -->|Select Bank| B[Bank List]
     A -->|Enter Account| C[Account Validation]
     A -->|Enter Amount| D[Amount Validation]
     A -->|Enter PIN| E[PIN Verification]
     A -->|Confirm| F[Process Transfer]
   ```

2. **Transaction History**:
   ```mermaid
   graph TD
     A[WalletCard] -->|View All| B[TransactionHistory]
     B -->|Filter| C[Filtered Transactions]
     B -->|Sort| D[Sorted Transactions]
     B -->|Click| E[Transaction Details]
   ```

## Best Practices

1. **Component Structure**:
   - Keep components focused and single-responsibility
   - Use TypeScript interfaces for props
   - Implement proper error handling
   - Add loading states

2. **State Management**:
   - Use React Context for global state
   - Keep local state minimal
   - Implement proper data flow

3. **Styling**:
   - Use Tailwind CSS classes
   - Follow design system
   - Maintain consistency

4. **Testing**:
   - Write unit tests
   - Test user interactions
   - Verify error states

## Common Patterns

### Form Handling

```typescript
const [formData, setFormData] = useState<FormData>({
  // initial state
});

const handleChange = (field: keyof FormData) => (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  setFormData(prev => ({
    ...prev,
    [field]: event.target.value
  }));
};
```

### Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await submitData();
  } finally {
    setIsLoading(false);
  }
};
```

### Error Handling

```typescript
const [error, setError] = useState<string | null>(null);

const handleOperation = async () => {
  try {
    await operation();
  } catch (err) {
    setError(err.message);
  }
};
```

## Component Testing

### Example Test

```typescript
describe('WalletCard', () => {
  it('renders balance correctly', () => {
    const { getByText } = render(
      <WalletCard
        balance={1000}
        currency="NGN"
        transactions={[]}
        onCurrencyToggle={() => {}}
        onViewAll={() => {}}
      />
    );
    expect(getByText('₦1,000.00')).toBeInTheDocument();
  });
});
```

## Future Improvements

1. **Component Library**:
   - Create a shared component library
   - Add storybook documentation
   - Implement component testing

2. **Performance**:
   - Implement code splitting
   - Add lazy loading
   - Optimize renders

3. **Accessibility**:
   - Add ARIA labels
   - Improve keyboard navigation
   - Add screen reader support 