import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';
import { addTransaction } from '@/localStorage'; // Import from original localStorage.ts

export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem('transactions');
  return transactionsString ? JSON.parse(transactionsString) : [];
};

export const createTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>): void => {
  const transactions = getTransactions();
  const newTransaction: Transaction = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...transaction,
  };
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  
  // Now we also call our local addTransaction to keep things in sync
  // This is for backward compatibility
  addTransaction(newTransaction);
};
