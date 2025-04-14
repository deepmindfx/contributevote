import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';
import { addTransaction } from '@/localStorage'; // Import from original localStorage.ts

export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  return transactionsString ? JSON.parse(transactionsString) : [];
};

export const createTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>): void => {
  try {
    const transactions = getTransactions();
    const newTransaction: Transaction = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...transaction,
    };
    
    // Add defensive check to ensure all required fields are present
    if (!transaction.userId && transaction.type !== 'system') {
      console.error("Transaction is missing userId", transaction);
      // For non-system transactions, userId is required
      return;
    }
    
    transactions.push(newTransaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    
    // Now we also call our local addTransaction to keep things in sync
    // This is for backward compatibility
    // Wrap in try-catch to prevent errors when user is logged out
    try {
      addTransaction(newTransaction);
    } catch (error) {
      console.info("Skip adding transaction to old storage system after logout", error);
    }
  } catch (error) {
    console.error("Failed to create transaction:", error);
  }
};
