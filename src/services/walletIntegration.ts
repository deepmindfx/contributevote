import { toast } from "sonner";
import { Transaction } from "@/services/localStorage/types";
import { getCurrentUser, getTransactions } from "@/services/localStorage";

// Let's create a proper interface for transaction filters
interface TransactionFilter {
  userId?: string;
  contributionId?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get transactions with optional filtering
 */
export const getWalletTransactions = (filters?: TransactionFilter): Transaction[] => {
  try {
    // Get transactions from localStorage
    const transactionsString = localStorage.getItem('transactions');
    if (!transactionsString) return [];
    
    const transactions: Transaction[] = JSON.parse(transactionsString);
    
    // Apply filters if provided
    if (!filters) return transactions;
    
    return transactions.filter(transaction => {
      // Filter by userId if provided
      if (filters.userId && transaction.userId !== filters.userId) return false;
      
      // Filter by contributionId if provided
      if (filters.contributionId && transaction.contributionId !== filters.contributionId) return false;
      
      // Filter by type if provided
      if (filters.type && transaction.type !== filters.type) return false;
      
      // Filter by status if provided
      if (filters.status && transaction.status !== filters.status) return false;
      
      // Filter by date range if provided
      if (filters.dateFrom || filters.dateTo) {
        const transactionDate = new Date(transaction.createdAt);
        
        if (filters.dateFrom && transactionDate < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && transactionDate > new Date(filters.dateTo)) return false;
      }
      
      return true;
    });
  } catch (error) {
    console.error("Error getting wallet transactions:", error);
    return [];
  }
};

// Safe type for transaction types
type TransactionType = "deposit" | "withdrawal" | "transfer" | "payment" | "vote";

/**
 * Process a wallet transaction
 * This is a placeholder for future implementation that might involve APIs
 */
export const processTransaction = (transaction: Partial<Transaction>): Promise<Transaction> => {
  return new Promise((resolve, reject) => {
    try {
      // Here we would typically call an API to process the transaction
      // For now we'll just simulate a successful transaction
      
      const completedTransaction: Transaction = {
        id: `tx_${Date.now()}`,
        userId: transaction.userId || '',
        contributionId: transaction.contributionId || '',
        type: (transaction.type as TransactionType) || 'deposit',
        amount: transaction.amount || 0,
        status: 'completed',
        description: transaction.description || '',
        paymentMethod: transaction.paymentMethod || 'wallet',
        referenceId: transaction.referenceId || `ref_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metaData: transaction.metaData || {}
      };
      
      // Add the transaction to localStorage
      addWalletTransaction(completedTransaction);
      
      resolve(completedTransaction);
    } catch (error) {
      console.error("Error processing transaction:", error);
      reject(error);
    }
  });
};

/**
 * Add a transaction to localStorage
 */
export const addWalletTransaction = (transaction: Transaction): void => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    const transactions = transactionsString ? JSON.parse(transactionsString) : [];
    
    // Add the transaction
    transactions.push(transaction);
    
    // Save back to localStorage
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (error) {
    console.error("Error adding wallet transaction:", error);
    toast.error("Failed to record transaction");
  }
};

interface PaymentInvoiceRequest {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
}

interface PaymentInvoiceResponse {
  checkoutUrl: string;
  paymentReference: string;
}

/**
 * Create a payment invoice using a mock API
 */
export const createPaymentInvoice = async (invoiceData: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse | null> => {
  return new Promise((resolve) => {
    // Simulate API call delay
    setTimeout(() => {
      // Generate a mock payment reference
      const paymentReference = `INV_${Date.now()}`;
      
      // Generate a mock checkout URL
      const checkoutUrl = `https://example.com/checkout/${paymentReference}`;
      
      // Resolve with the mock data
      resolve({
        checkoutUrl,
        paymentReference
      });
    }, 500);
  });
};

/**
 * Get reserved account transactions from a mock API
 */
export const getReservedAccountTransactions = async (accountReference: string): Promise<Transaction[]> => {
  return new Promise((resolve) => {
    // Simulate API call delay
    setTimeout(() => {
      // Generate mock transactions
      const mockTransactions: Transaction[] = [
        {
          id: `TXN_${Date.now() + 1}`,
          userId: 'user123',
          contributionId: '',
          type: 'deposit',
          amount: 5000,
          status: 'completed',
          description: 'Wallet deposit',
          paymentMethod: 'bank_transfer',
          referenceId: `REF_${Date.now() + 1}`,
          createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          metaData: {
            accountReference: accountReference,
            senderName: 'John Doe',
            senderBank: 'Mock Bank'
          }
        },
        {
          id: `TXN_${Date.now() + 2}`,
          userId: 'user123',
          contributionId: '',
          type: 'withdrawal',
          amount: 2000,
          status: 'completed',
          description: 'Wallet withdrawal',
          paymentMethod: 'bank_transfer',
          referenceId: `REF_${Date.now() + 2}`,
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
          metaData: {
            accountReference: accountReference,
            receiverName: 'John Doe',
            receiverBank: 'Mock Bank'
          }
        }
      ];
      
      // Resolve with the mock transactions
      resolve(mockTransactions);
    }, 500);
  });
};

/**
 * Sync reserved account transactions with local storage
 */
export const syncReservedAccountTransactions = async (userId: string): Promise<boolean> => {
  try {
    const user = getCurrentUser();
    if (!user || !user.id || !user.reservedAccount) {
      return false;
    }

    // Don't try to access user.transactions which doesn't exist
    // Instead, get transactions directly from localStorage
    const existingTransactions = getTransactions().filter(t => t.userId === userId);
    
    // Fetch transactions from the mock API
    const newTransactions = await getReservedAccountTransactions(user.reservedAccount.accountReference);
    
    // Filter out transactions that already exist in local storage
    const transactionsToAdd = newTransactions.filter(newTx => {
      return !existingTransactions.some(existingTx => existingTx.id === newTx.id);
    });
    
    // Add the new transactions to local storage
    transactionsToAdd.forEach(transaction => {
      addWalletTransaction(transaction);
    });
    
    return true;
  } catch (error) {
    console.error("Error syncing reserved account transactions:", error);
    return false;
  }
};
