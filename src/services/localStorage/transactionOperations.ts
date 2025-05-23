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
    
    // Enhanced duplicate check for Flutterwave transactions
    if (transaction.metaData?.paymentReference) {
      const existingTransaction = transactions.find(t => 
        t.metaData?.paymentReference === transaction.metaData?.paymentReference ||
        (t.metaData?.paymentDetails?.transactionId === transaction.metaData?.paymentDetails?.transactionId && 
         transaction.metaData?.paymentDetails?.transactionId)
      );
      
      if (existingTransaction) {
        console.warn("Duplicate transaction detected, skipping:", {
          existing: existingTransaction,
          attempted: transaction
        });
        return;
      }
    }
    
    // Generate a unique ID that includes a timestamp prefix for better uniqueness
    const timestamp = new Date().getTime();
    const uniqueId = `${timestamp}-${uuidv4()}`;
    
    const newTransaction: Transaction = {
      id: uniqueId,
      createdAt: new Date().toISOString(),
      ...transaction,
    };
    
    // Add defensive check to ensure all required fields are present
    if (!transaction.userId && transaction.type !== 'deposit' && transaction.type !== 'withdrawal' 
        && transaction.type !== 'transfer' && transaction.type !== 'payment' && transaction.type !== 'vote') {
      console.error("Transaction is missing userId", transaction);
      return;
    }
    
    // Add the new transaction to the beginning of the array
    transactions.unshift(newTransaction);
    
    // Ensure we don't exceed a reasonable limit of transactions in localStorage
    const MAX_TRANSACTIONS = 1000;
    if (transactions.length > MAX_TRANSACTIONS) {
      transactions.length = MAX_TRANSACTIONS;
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('transactions', JSON.stringify(transactions));
      console.log("Transaction saved successfully:", {
        id: newTransaction.id,
        amount: newTransaction.amount,
        type: newTransaction.type,
        reference: newTransaction.metaData?.paymentReference
      });
    } catch (storageError) {
      console.error("Failed to save to localStorage:", storageError);
      return;
    }
    
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
