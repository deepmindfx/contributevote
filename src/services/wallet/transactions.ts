
import { toast } from "sonner";
import { Transaction } from "@/services/localStorage/types";

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
        type: transaction.type || 'unknown',
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
