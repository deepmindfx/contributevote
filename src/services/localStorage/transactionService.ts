
import { v4 as uuidv4 } from "uuid";
import { Transaction, localStorageKeys } from "./types";
import { getCurrentUser } from "./userService";
import { getContributionById, updateContribution } from "./contributionService";
import { updateUserBalance } from "./userService";

/**
 * Function to get all transactions
 */
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem(localStorageKeys.transactions);
  if (!transactionsString) return [];
  return JSON.parse(transactionsString);
};

/**
 * Function to get all transactions (alias for getTransactions)
 */
export const getAllTransactions = getTransactions;

/**
 * Function to get transaction by ID
 */
export const getTransactionById = (id: string): Transaction | undefined => {
  const transactions = getTransactions();
  return transactions.find(transaction => transaction.id === id);
};

/**
 * Function to add a transaction
 */
export const addTransaction = (transactionData: Omit<Transaction, "id">): Transaction => {
  const transactions = getTransactions();
  const newTransaction = {
    id: uuidv4(),
    ...transactionData
  };
  
  localStorage.setItem(localStorageKeys.transactions, JSON.stringify([...transactions, newTransaction]));
  return newTransaction;
};

/**
 * Function to contribute to a group
 */
export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false): Transaction | null => {
  const currentUser = getCurrentUser();
  const contribution = getContributionById(contributionId);
  
  if (!currentUser || !contribution) return null;
  
  // Check if user has enough balance
  if (currentUser.walletBalance < amount) {
    return null;
  }
  
  // Update user balance
  updateUserBalance(-amount);
  
  // Update contribution amount
  updateContribution(contributionId, {
    currentAmount: contribution.currentAmount + amount
  });
  
  // Add transaction
  const transaction = addTransaction({
    userId: currentUser.id,
    contributionId,
    amount,
    type: "vote",
    status: "completed",
    createdAt: new Date().toISOString(),
    description: `Contribution to ${contribution.name}`,
    anonymous,
    metaData: {
      contributionName: contribution.name
    }
  });
  
  return transaction;
};

/**
 * Function to check if a user has contributed to a group
 */
export const hasContributed = (userId: string, contributionId: string): boolean => {
  const transactions = getTransactions();
  return transactions.some(t => 
    t.userId === userId && 
    t.contributionId === contributionId && 
    t.type === "vote" &&
    t.status === "completed"
  );
};

/**
 * Function to generate a receipt for a contribution
 */
export const generateContributionReceipt = (transactionId: string): any => {
  const transaction = getTransactionById(transactionId);
  if (!transaction) return null;
  
  // Create receipt object
  return {
    transactionId,
    amount: transaction.amount,
    date: transaction.createdAt,
    description: transaction.description,
    status: transaction.status
  };
};

/**
 * Function to handle contribution via account number
 */
export const contributeByAccountNumber = (
  accountNumber: string, 
  amount: number, 
  contributorInfo: any, 
  anonymous: boolean = false
) => {
  // Implementation for contributing via account number
  const contribution = getContributionByAccountNumber(accountNumber);
  if (!contribution) {
    throw new Error("Invalid account number");
  }

  // Create a transaction record
  const transaction = addTransaction({
    userId: contributorInfo.id || "guest",
    contributionId: contribution.id,
    amount,
    type: "vote",
    status: "completed",
    createdAt: new Date().toISOString(),
    description: `Contribution to ${contribution.name}`,
    anonymous,
    metaData: {
      contributorName: contributorInfo.name,
      contributorEmail: contributorInfo.email,
      contributorPhone: contributorInfo.phone,
      contributionName: contribution.name
    }
  });

  // Update contribution amount
  updateContribution(contribution.id, {
    currentAmount: contribution.currentAmount + amount
  });

  return transaction;
};
