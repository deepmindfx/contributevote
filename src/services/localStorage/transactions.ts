
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './types';

// Get all transactions from localStorage
export const getTransactions = (): Transaction[] => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    return transactionsString ? JSON.parse(transactionsString) : [];
  } catch (error) {
    console.error("Error getting transactions:", error);
    return [];
  }
};

// Create a new transaction
export const createTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>): void => {
  const transactions = getTransactions();
  const newTransaction: Transaction = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...transaction,
  };
  transactions.push(newTransaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  
  // Also call addTransaction for backward compatibility
  addTransaction(newTransaction);
};

// Direct implementation of addTransaction
export const addTransaction = (transaction: any): void => {
  try {
    const transactionsString = localStorage.getItem('transactions');
    const transactions = transactionsString ? JSON.parse(transactionsString) : [];
    
    // Add the transaction
    transactions.push(transaction);
    
    // Save back to localStorage
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (error) {
    console.error("Error in addTransaction:", error);
  }
};

export const generateContributionReceipt = (transactionId: string) => {
  const transactionsString = localStorage.getItem('transactions');
  if (!transactionsString) return null;
  
  const transactions = JSON.parse(transactionsString);
  const transaction = transactions.find((t: Transaction) => t.id === transactionId);
  if (!transaction) return null;
  
  const contributionsString = localStorage.getItem('contributions');
  if (!contributionsString) return null;
  
  const contributions = JSON.parse(contributionsString);
  const contribution = contributions.find((c: any) => c.id === transaction.contributionId);
  if (!contribution) return null;
  
  const usersString = localStorage.getItem('users');
  if (!usersString) return null;
  
  const users = JSON.parse(usersString);
  const user = users.find((u: any) => u.id === transaction.userId);
  if (!user) return null;
  
  return {
    receiptNumber: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`,
    date: transaction.createdAt,
    contributionName: contribution.name,
    accountNumber: contribution.accountNumber,
    contributorName: user.name,
    amount: transaction.amount,
  };
};
