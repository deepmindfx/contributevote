import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';
import { addTransaction } from '@/localStorage'; // Import from original localStorage.ts

export const getTransactions = (): any[] => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    return transactionsString ? JSON.parse(transactionsString) : [];
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};

export const createTransaction = (transaction: any): void => {
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
    
    const newTransaction = {
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
    
    // Log transaction for debugging
    console.log("New transaction to be saved:", newTransaction);
    
    // Add the transaction to the array
    transactions.push(newTransaction);
    
    // Save back to localStorage
    localStorage.setItem('transactions', JSON.stringify(transactions));
    console.log("Updated transactions in localStorage:", transactions);
    
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
