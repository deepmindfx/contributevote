
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';
import { addTransaction } from '@/localStorage'; // Import from original localStorage.ts

export const getTransactions = (): Transaction[] => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    return transactionsString ? JSON.parse(transactionsString) : [];
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};

export const createTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>): void => {
  try {
    const transactions = getTransactions();
    
    // Check for duplicate transactions with same amount and reference within last 5 minutes
    // This helps prevent duplicate transactions from being created
    if (transaction.reference) {
      const existingTransaction = transactions.find(t => 
        t.reference === transaction.reference && 
        t.amount === transaction.amount
      );
      
      if (existingTransaction) {
        console.warn("Duplicate transaction detected, skipping:", transaction);
        return;
      }
    }
    
    // Also check for near-duplicate transactions (same type, amount, and contribution)
    // within the last 30 seconds to prevent double-processing
    const last30Sec = Date.now() - 30 * 1000;
    const recentDuplicate = transactions.find(t => 
      t.type === transaction.type && 
      t.amount === transaction.amount &&
      t.contributionId === transaction.contributionId &&
      new Date(t.createdAt).getTime() > last30Sec
    );
    
    if (recentDuplicate) {
      console.warn("Recent duplicate transaction detected, skipping:", transaction);
      return;
    }
    
    const newTransaction: Transaction = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...transaction,
    };
    
    // Add defensive check to ensure all required fields are present
    if (!transaction.userId && transaction.type !== 'deposit' && transaction.type !== 'withdrawal' 
        && transaction.type !== 'transfer' && transaction.type !== 'payment' && transaction.type !== 'vote') {
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
      console.info("Skip adding transaction to old storage system", error);
    }
  } catch (error) {
    console.error("Failed to create transaction:", error);
  }
};
