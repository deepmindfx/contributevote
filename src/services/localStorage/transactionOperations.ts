
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
    
    // Strengthen duplicate check:
    // 1. Check reference duplication
    if (transaction.reference) {
      const existingTransactionByRef = transactions.find(t => 
        t.reference === transaction.reference
      );
      
      if (existingTransactionByRef) {
        console.warn("Duplicate transaction by reference detected, skipping:", transaction);
        return;
      }
    }
    
    // 2. Check for near-duplicate transactions based on properties
    // This catches duplicates even if they don't have the same reference
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
    
    // 3. Add an additional check for payment references in metaData
    if (transaction.metaData?.paymentReference) {
      const existingByPaymentRef = transactions.find(t => 
        t.metaData?.paymentReference === transaction.metaData?.paymentReference
      );
      
      if (existingByPaymentRef) {
        console.warn("Duplicate transaction by payment reference detected, skipping:", transaction);
        return;
      }
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
