import { v4 as uuidv4 } from "uuid";
import { CardTokenData, InvoiceData, ReservedAccountData } from "@/services/wallet/types";

/**
 * Type definitions for local storage data
 */

/**
 * Interface for user data stored in local storage
 */
export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  username?: string;
  profileImage?: string;
  walletBalance: number;
  reservedAccount?: ReservedAccountData;
  cardTokens?: CardTokenData[];
  invoices?: InvoiceData[];
  role: "user" | "admin";
  status: "active" | "paused";
  pin?: string;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled: boolean;
  };
}

/**
 * Interface for contribution data stored in local storage
 */
export interface Contribution {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  creatorId: string;
  category: string;
  status: "active" | "completed" | "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  videoUrl?: string;
  location?: string;
  isPublic: boolean;
  isAnonymousAllowed: boolean;
}

/**
 * Interface for transaction data stored in local storage
 */
export interface Transaction {
  id: string;
  userId: string;
  contributionId: string;
  amount: number;
  type: "deposit" | "withdrawal" | "vote";
  status: "pending" | "completed" | "rejected";
  createdAt: string;
  description: string;
  metaData?: any;
}

/**
 * Interface for app statistics data stored in local storage
 */
export interface AppStats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalAmount: number;
  activeRequests: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}

/**
 * Local storage keys
 */
const localStorageKeys = {
  users: "collectipay_users",
  contributions: "collectipay_contributions",
  transactions: "collectipay_transactions",
  appStats: "collectipay_app_stats",
};

/**
 * ===================================================================================================================================
 *  User Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all users from local storage
 * @returns {User[]} - An array of users
 */
export const getAllUsers = (): User[] => {
  const users = localStorage.getItem(localStorageKeys.users);
  return users ? JSON.parse(users) : [];
};

/**
 * Function to get a user by ID from local storage
 * @param {string} id - The ID of the user to retrieve
 * @returns {User | undefined} - The user with the given ID, or undefined if not found
 */
export const getUserById = (id: string): User | undefined => {
  const users = getAllUsers();
  return users.find((user) => user.id === id);
};

/**
 * Function to add a new user to local storage
 * @param {Omit<User, 'id'>} userData - The data for the new user (excluding the ID)
 * @returns {User} - The newly created user object
 */
export const addUser = (userData: Omit<User, "id">): User => {
  const users = getAllUsers();
  const newUser: User = {
    id: uuidv4(),
    ...userData,
  };
  localStorage.setItem(localStorageKeys.users, JSON.stringify([...users, newUser]));
  return newUser;
};

/**
 * Function to update an existing user in local storage
 * @param {string} id - The ID of the user to update
 * @param {Partial<User>} updatedUserData - The data to update for the user
 * @returns {User | undefined} - The updated user object, or undefined if the user was not found
 */
export const updateUser = (id: string, updatedUserData: Partial<User>): User | undefined => {
  const users = getAllUsers();
  const updatedUsers = users.map((user) => {
    if (user.id === id) {
      return { ...user, ...updatedUserData };
    }
    return user;
  });
  localStorage.setItem(localStorageKeys.users, JSON.stringify(updatedUsers));
  return getUserById(id);
};

/**
 * Function to delete a user from local storage
 * @param {string} id - The ID of the user to delete
 * @returns {boolean} - True if the user was successfully deleted, false otherwise
 */
export const deleteUser = (id: string): boolean => {
  const users = getAllUsers();
  const filteredUsers = users.filter((user) => user.id !== id);
  localStorage.setItem(localStorageKeys.users, JSON.stringify(filteredUsers));
  return users.length !== filteredUsers.length;
};

/**
 * Function to update a user's wallet balance in local storage
 * @param {string} id - The ID of the user to update
 * @param {number} amount - The amount to add to the user's wallet balance
 * @returns {User | undefined} - The updated user object, or undefined if the user was not found
 */
export const updateUserBalance = (amount: number): User | undefined => {
  // Get the current user from local storage
  const userString = localStorage.getItem("collectipay_currentUser");
  if (!userString) {
    console.error("No current user found in local storage");
    return undefined;
  }
  
  const currentUser: User = JSON.parse(userString);
  const id = currentUser.id;
  
  const users = getAllUsers();
  const updatedUsers = users.map((user) => {
    if (user.id === id) {
      const newBalance = user.walletBalance + amount;
      return { ...user, walletBalance: newBalance >= 0 ? newBalance : 0 };
    }
    return user;
  });
  
  localStorage.setItem(localStorageKeys.users, JSON.stringify(updatedUsers));
  
  // Update the current user in local storage
  const updatedUser = getUserById(id);
  if (updatedUser) {
    localStorage.setItem("collectipay_currentUser", JSON.stringify(updatedUser));
  }
  
  return updatedUser;
};

/**
 * ===================================================================================================================================
 *  Contribution Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all contributions from local storage
 * @returns {Contribution[]} - An array of contributions
 */
export const getAllContributions = (): Contribution[] => {
  const contributions = localStorage.getItem(localStorageKeys.contributions);
  return contributions ? JSON.parse(contributions) : [];
};

/**
 * Function to get a contribution by ID from local storage
 * @param {string} id - The ID of the contribution to retrieve
 * @returns {Contribution | undefined} - The contribution with the given ID, or undefined if not found
 */
export const getContributionById = (id: string): Contribution | undefined => {
  const contributions = getAllContributions();
  return contributions.find((contribution) => contribution.id === id);
};

/**
 * Function to add a new contribution to local storage
 * @param {Omit<Contribution, 'id'>} contributionData - The data for the new contribution (excluding the ID)
 * @returns {Contribution} - The newly created contribution object
 */
export const addContribution = (contributionData: Omit<Contribution, "id">): Contribution => {
  const contributions = getAllContributions();
  const newContribution: Contribution = {
    id: uuidv4(),
    ...contributionData,
  };
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify([...contributions, newContribution]));
  return newContribution;
};

/**
 * Function to update an existing contribution in local storage
 * @param {string} id - The ID of the contribution to update
 * @param {Partial<Contribution>} updatedContributionData - The data to update for the contribution
 * @returns {Contribution | undefined} - The updated contribution object, or undefined if the contribution was not found
 */
export const updateContribution = (id: string, updatedContributionData: Partial<Contribution>): Contribution | undefined => {
  const contributions = getAllContributions();
  const updatedContributions = contributions.map((contribution) => {
    if (contribution.id === id) {
      return { ...contribution, ...updatedContributionData };
    }
    return contribution;
  });
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify(updatedContributions));
  return getContributionById(id);
};

/**
 * Function to delete a contribution from local storage
 * @param {string} id - The ID of the contribution to delete
 * @returns {boolean} - True if the contribution was successfully deleted, false otherwise
 */
export const deleteContribution = (id: string): boolean => {
  const contributions = getAllContributions();
  const filteredContributions = contributions.filter((contribution) => contribution.id !== id);
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify(filteredContributions));
  return contributions.length !== filteredContributions.length;
};

/**
 * ===================================================================================================================================
 *  Transaction Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all transactions from local storage
 * @returns {Transaction[]} - An array of transactions
 */
export const getAllTransactions = (): Transaction[] => {
  const transactions = localStorage.getItem(localStorageKeys.transactions);
  return transactions ? JSON.parse(transactions) : [];
};

/**
 * Function to get a transaction by ID from local storage
 * @param {string} id - The ID of the transaction to retrieve
 * @returns {Transaction | undefined} - The transaction with the given ID, or undefined if not found
 */
export const getTransactionById = (id: string): Transaction | undefined => {
  const transactions = getAllTransactions();
  return transactions.find((transaction) => transaction.id === id);
};

/**
 * Function to add a new transaction to local storage
 * @param {Omit<Transaction, 'id'>} transactionData - The data for the new transaction (excluding the ID)
 * @returns {Transaction} - The newly created transaction object
 */
export const addTransaction = (transactionData: Omit<Transaction, "id">): Transaction => {
  const transactions = getAllTransactions();
  const newTransaction: Transaction = {
    id: uuidv4(),
    ...transactionData,
  };
  localStorage.setItem(localStorageKeys.transactions, JSON.stringify([...transactions, newTransaction]));
  return newTransaction;
};

/**
 * Function to update an existing transaction in local storage
 * @param {string} id - The ID of the transaction to update
 * @param {Partial<Transaction>} updatedTransactionData - The data to update for the transaction
 * @returns {Transaction | undefined} - The updated transaction object, or undefined if the transaction was not found
 */
export const updateTransaction = (id: string, updatedTransactionData: Partial<Transaction>): Transaction | undefined => {
  const transactions = getAllTransactions();
  const updatedTransactions = transactions.map((transaction) => {
    if (transaction.id === id) {
      return { ...transaction, ...updatedTransactionData };
    }
    return transaction;
  });
  localStorage.setItem(localStorageKeys.transactions, JSON.stringify(updatedTransactions));
  return getTransactionById(id);
};

/**
 * Function to delete a transaction from local storage
 * @param {string} id - The ID of the transaction to delete
 * @returns {boolean} - True if the transaction was successfully deleted, false otherwise
 */
export const deleteTransaction = (id: string): boolean => {
  const transactions = getAllTransactions();
  const filteredTransactions = transactions.filter((transaction) => transaction.id !== id);
  localStorage.setItem(localStorageKeys.transactions, JSON.stringify(filteredTransactions));
  return transactions.length !== filteredTransactions.length;
};

/**
 * ===================================================================================================================================
 *  App Statistics Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get app statistics from local storage
 * @returns {AppStats} - The app statistics
 */
export const getAppStats = (): AppStats => {
  const appStats = localStorage.getItem(localStorageKeys.appStats);
  return appStats ? JSON.parse(appStats) : {
    totalUsers: 0,
    totalContributions: 0,
    totalTransactions: 0,
    totalAmount: 0,
    activeRequests: 0,
    totalWithdrawals: 0,
    totalAmountContributed: 0,
  };
};

/**
 * Function to update app statistics in local storage
 * @param {Partial<AppStats>} updatedAppStats - The data to update for the app statistics
 */
export const updateAppStats = (updatedAppStats: Partial<AppStats>): void => {
  const currentAppStats = getAppStats();
  const newAppStats = { ...currentAppStats, ...updatedAppStats };
  localStorage.setItem(localStorageKeys.appStats, JSON.stringify(newAppStats));
};
import { User, Transaction } from '../localStorage';

// Re-export types from localStorage.ts
export type { User, Transaction };

// Define additional types needed by the application
export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  creatorId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
    votedAt: string;
  }[];
  createdAt: string;
  deadline: string;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalAmount: number;
  activeRequests: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}

// Export missing functions that were referenced in AppContext
export const getCurrentUser = (): User | null => {
  const userString = localStorage.getItem("collectipay_currentUser");
  if (!userString) return null;
  return JSON.parse(userString);
};

export const getUsers = (): User[] => {
  const usersString = localStorage.getItem("collectipay_users");
  if (!usersString) return [];
  return JSON.parse(usersString);
};

export const getContributions = () => {
  const contributionsString = localStorage.getItem("collectipay_contributions");
  if (!contributionsString) return [];
  return JSON.parse(contributionsString);
};

export const getUserContributions = (userId: string) => {
  const contributions = getContributions();
  if (!contributions) return [];
  return contributions.filter((c: any) => c.creatorId === userId || c.members?.includes(userId));
};

export const getWithdrawalRequests = () => {
  const requestsString = localStorage.getItem("collectipay_withdrawal_requests");
  if (!requestsString) return [];
  return JSON.parse(requestsString);
};

export const getTransactions = () => {
  const transactionsString = localStorage.getItem("collectipay_transactions");
  if (!transactionsString) return [];
  return JSON.parse(transactionsString);
};

export const getStatistics = (): Stats => {
  const statsString = localStorage.getItem("collectipay_app_stats");
  if (!statsString) {
    return {
      totalUsers: 0,
      totalContributions: 0,
      totalTransactions: 0,
      totalAmount: 0,
      activeRequests: 0,
      totalWithdrawals: 0,
      totalAmountContributed: 0
    };
  }
  return JSON.parse(statsString);
};

export const createContribution = (contribution: any) => {
  const contributions = getContributions();
  // Add implementation here if needed
  return contribution;
};

export const contributeToGroup = (contributionId: string, amount: number, anonymous: boolean = false) => {
  // Implementation would go here
};

export const contributeByAccountNumber = (accountNumber: string, amount: number, contributorInfo: any, anonymous: boolean = false) => {
  // Implementation would go here
};

export const createWithdrawalRequest = (request: any) => {
  // Implementation would go here
};

export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject') => {
  // Implementation would go here
};

export const updateUser = (userData: Partial<User>) => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem("collectipay_currentUser", JSON.stringify(updatedUser));
  
  // Also update the user in the users array
  const users = getUsers();
  const updatedUsers = users.map(user => 
    user.id === currentUser.id ? updatedUser : user
  );
  localStorage.setItem("collectipay_users", JSON.stringify(updatedUsers));
  
  return updatedUser;
};

export const generateShareLink = (contributionId: string) => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

export const initializeLocalStorage = () => {
  // Initialize any required localStorage items
};

export const updateUserById = (userId: string, userData: Partial<User>) => {
  const users = getUsers();
  const updatedUsers = users.map(user => {
    if (user.id === userId) {
      return { ...user, ...userData };
    }
    return user;
  });
  localStorage.setItem("collectipay_users", JSON.stringify(updatedUsers));
  
  // Also update current user if it's the same user
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    const updatedUser = { ...currentUser, ...userData };
    localStorage.setItem("collectipay_currentUser", JSON.stringify(updatedUser));
  }
  
  return updatedUsers.find(user => user.id === userId) || null;
};

export const depositToUser = (userId: string, amount: number) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  
  return updateUserById(userId, {
    walletBalance: user.walletBalance + amount
  });
};

export const pauseUser = (userId: string) => {
  return updateUserById(userId, { status: "paused" });
};

export const activateUser = (userId: string) => {
  return updateUserById(userId, { status: "active" });
};

export const logoutUser = () => {
  localStorage.removeItem("collectipay_currentUser");
};

export const addNotification = (notification: any) => {
  // Implementation would go here
};

export const getUserByEmail = (email: string) => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

export const getUserByPhone = (phone: string) => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

export const pingGroupMembersForVote = (requestId: string) => {
  // Implementation would go here
};

export const generateContributionReceipt = (transactionId: string) => {
  const transactions = getTransactions();
  const transaction = transactions.find((t: any) => t.id === transactionId);
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

export const updateWithdrawalRequestsStatus = () => {
  // Implementation would go here
};

export const verifyUserWithOTP = (userId: string) => {
  return updateUserById(userId, { verified: true });
};

export const getContributionByAccountNumber = (accountNumber: string) => {
  const contributions = getContributions();
  return contributions.find((c: any) => c.accountNumber === accountNumber) || null;
};

export const hasContributed = (userId: string, contributionId: string) => {
  const transactions = getTransactions();
  return transactions.some((t: any) => 
    t.userId === userId && 
    t.contributionId === contributionId && 
    t.type === "vote" &&
    t.status === "completed"
  );
};

export const markAllNotificationsAsRead = (userId: string) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.notifications) return;
  
  const updatedNotifications = user.notifications.map((n: any) => ({
    ...n,
    read: true
  }));
  
  updateUserById(userId, { notifications: updatedNotifications });
};

export const markNotificationAsRead = (userId: string, notificationId: string) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.notifications) return;
  
  const updatedNotifications = user.notifications.map((n: any) => 
    n.id === notificationId ? { ...n, read: true } : n
  );
  
  updateUserById(userId, { notifications: updatedNotifications });
};

// Helper function to add a transaction
export const addTransaction = (transactionData: Omit<Transaction, "id">) => {
  const transactions = getTransactions();
  const newTransaction = {
    id: crypto.randomUUID(),
    ...transactionData
  };
  
  localStorage.setItem("collectipay_transactions", JSON.stringify([...transactions, newTransaction]));
  return newTransaction;
};
import { getCurrentUser, getUsers } from "@/services/localStorage";
import { isValid } from "date-fns";

// Add the missing activateUser function
export const activateUser = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].status = "active";
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.status = "active";
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in activateUser:", error);
  }
};

// Add the missing pauseUser function
export const pauseUser = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].status = "paused";
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.status = "paused";
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in pauseUser:", error);
  }
};

// Add the missing verifyUserWithOTP function 
export const verifyUserWithOTP = (userId: string): void => {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index >= 0) {
      users[index].verified = true;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        currentUser.verified = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

// Helper to validate dates
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return isValid(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};

// Let's add other functions that are needed based on the errors:

// Re-export necessary types and functions from services/localStorage to fix the errors
export * from "@/services/localStorage";

// Only add these if they're not already in @/services/localStorage
export const updateUserById = (userId: string, userData: Partial<any>): any => {
  try {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex >= 0) {
      users[userIndex] = { ...users[userIndex], ...userData };
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return updatedUser;
      }
      
      return users[userIndex];
    }
    return null;
  } catch (error) {
    console.error("Error in updateUserById:", error);
    return null;
  }
};

// Add missing depositToUser function
export const depositToUser = (userId: string, amount: number): any => {
  return updateUserById(userId, {
    walletBalance: (user: any) => user.walletBalance + amount
  });
};
