
import { v4 as uuidv4 } from "uuid";
import { CardTokenData, InvoiceData, ReservedAccountData } from "@/services/wallet/types";
import { isValid } from "date-fns";

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
  verified?: boolean;
  createdAt?: string;
  notifications?: Array<{
    id: string;
    message: string;
    read: boolean;
    createdAt: string;
    relatedId?: string;
  }>;
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
  targetAmount?: number;
  frequency?: "daily" | "weekly" | "monthly" | "one-time";
  contributionAmount?: number;
  votingThreshold?: number;
  accountNumber?: string;
  members?: string[];
  contributors?: Array<{
    userId: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }>;
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
  anonymous?: boolean;
  metaData?: any;
}

/**
 * Interface for withdrawal request
 */
export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  creatorId: string;
  amount: number;
  reason: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
    votedAt: string;
  }[];
  createdAt: string;
  deadline: string;
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
  withdrawalRequests: "collectipay_withdrawal_requests",
  currentUser: "collectipay_currentUser"
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
export const getUsers = (): User[] => {
  const users = localStorage.getItem(localStorageKeys.users);
  return users ? JSON.parse(users) : [];
};

/**
 * Function to get user by ID
 */
export const getUserById = (id: string): User | undefined => {
  const users = getUsers();
  return users.find((user) => user.id === id);
};

/**
 * Function to get the current logged-in user
 */
export const getCurrentUser = (): User | null => {
  const userString = localStorage.getItem(localStorageKeys.currentUser);
  if (!userString) return null;
  return JSON.parse(userString);
};

/**
 * Function to update user information
 */
export const updateUser = (userData: Partial<User>): User | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const updatedUser = { ...currentUser, ...userData };
  localStorage.setItem(localStorageKeys.currentUser, JSON.stringify(updatedUser));
  
  // Also update the user in the users array
  const users = getUsers();
  const updatedUsers = users.map(user => 
    user.id === currentUser.id ? updatedUser : user
  );
  localStorage.setItem(localStorageKeys.users, JSON.stringify(updatedUsers));
  
  return updatedUser;
};

/**
 * Function to update a user by ID
 */
export const updateUserById = (userId: string, userData: Partial<User>): User | null => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex >= 0) {
    users[userIndex] = { ...users[userIndex], ...userData };
    localStorage.setItem(localStorageKeys.users, JSON.stringify(users));
    
    // If this is the current user, update that too
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      const updatedUser = { ...currentUser, ...userData };
      localStorage.setItem(localStorageKeys.currentUser, JSON.stringify(updatedUser));
      return updatedUser;
    }
    
    return users[userIndex];
  }
  return null;
};

/**
 * Function to add a new user to local storage
 */
export const addUser = (userData: Omit<User, "id">): User => {
  const users = getUsers();
  const newUser: User = {
    id: uuidv4(),
    ...userData,
  };
  localStorage.setItem(localStorageKeys.users, JSON.stringify([...users, newUser]));
  return newUser;
};

/**
 * Function to update a user's wallet balance
 */
export const updateUserBalance = (amount: number): User | undefined => {
  // Get the current user from local storage
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error("No current user found in local storage");
    return undefined;
  }
  
  return updateUserById(currentUser.id, {
    walletBalance: Math.max(0, currentUser.walletBalance + amount)
  });
};

/**
 * Function to deposit money to a user's wallet
 */
export const depositToUser = (userId: string, amount: number): User | null => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  
  return updateUserById(userId, {
    walletBalance: user.walletBalance + amount
  });
};

/**
 * Function to activate a user account
 */
export const activateUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: "active" });
  } catch (error) {
    console.error("Error in activateUser:", error);
  }
};

/**
 * Function to pause a user account
 */
export const pauseUser = (userId: string): void => {
  try {
    updateUserById(userId, { status: "paused" });
  } catch (error) {
    console.error("Error in pauseUser:", error);
  }
};

/**
 * Function to verify a user with OTP
 */
export const verifyUserWithOTP = (userId: string): void => {
  try {
    updateUserById(userId, { verified: true });
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

/**
 * Function to get user by email
 */
export const getUserByEmail = (email: string): User | null => {
  const users = getUsers();
  return users.find(user => user.email === email) || null;
};

/**
 * Function to get user by phone
 */
export const getUserByPhone = (phone: string): User | null => {
  const users = getUsers();
  return users.find(user => user.phone === phone) || null;
};

/**
 * Function to log out the current user
 */
export const logoutUser = (): void => {
  localStorage.removeItem(localStorageKeys.currentUser);
};

/**
 * Function to mark all notifications as read
 */
export const markAllNotificationsAsRead = (userId?: string): void => {
  const currentUser = getCurrentUser();
  if (!userId && !currentUser) return;
  
  const targetUserId = userId || currentUser.id;
  const user = getUserById(targetUserId);
  
  if (user && user.notifications && user.notifications.length > 0) {
    const updatedNotifications = user.notifications.map(n => ({
      ...n,
      read: true
    }));
    
    updateUserById(targetUserId, { notifications: updatedNotifications });
  }
};

/**
 * Function to mark a specific notification as read
 */
export const markNotificationAsRead = (notificationId: string, userId?: string): void => {
  const currentUser = getCurrentUser();
  if (!userId && !currentUser) return;
  
  const targetUserId = userId || currentUser.id;
  const user = getUserById(targetUserId);
  
  if (user && user.notifications) {
    const updatedNotifications = user.notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    
    updateUserById(targetUserId, { notifications: updatedNotifications });
  }
};

/**
 * ===================================================================================================================================
 *  Contribution Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all contributions
 */
export const getContributions = (): Contribution[] => {
  const contributionsString = localStorage.getItem(localStorageKeys.contributions);
  if (!contributionsString) return [];
  return JSON.parse(contributionsString);
};

/**
 * Function to get user contributions
 */
export const getUserContributions = (userId: string): Contribution[] => {
  const contributions = getContributions();
  if (!contributions) return [];
  return contributions.filter(c => c.creatorId === userId || c.members?.includes(userId));
};

/**
 * Function to get contribution by ID
 */
export const getContributionById = (id: string): Contribution | undefined => {
  const contributions = getContributions();
  return contributions.find(contribution => contribution.id === id);
};

/**
 * Function to create a new contribution
 */
export const createContribution = (contributionData: any): Contribution => {
  const contributions = getContributions();
  const newContribution = {
    id: uuidv4(),
    ...contributionData,
    currentAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify([...contributions, newContribution]));
  return newContribution;
};

/**
 * Function to update a contribution
 */
export const updateContribution = (id: string, updatedData: Partial<Contribution>): Contribution | undefined => {
  const contributions = getContributions();
  const updatedContributions = contributions.map(contribution => {
    if (contribution.id === id) {
      return { ...contribution, ...updatedData, updatedAt: new Date().toISOString() };
    }
    return contribution;
  });
  
  localStorage.setItem(localStorageKeys.contributions, JSON.stringify(updatedContributions));
  return getContributionById(id);
};

/**
 * Function to get a contribution by account number
 */
export const getContributionByAccountNumber = (accountNumber: string): Contribution | null => {
  const contributions = getContributions();
  return contributions.find(c => c.accountNumber === accountNumber) || null;
};

/**
 * Function to generate a share link for a contribution
 */
export const generateShareLink = (contributionId: string): string => {
  return `${window.location.origin}/contribute/share/${contributionId}`;
};

/**
 * ===================================================================================================================================
 *  Transaction Data Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all transactions
 */
export const getTransactions = (): Transaction[] => {
  const transactionsString = localStorage.getItem(localStorageKeys.transactions);
  if (!transactionsString) return [];
  return JSON.parse(transactionsString);
};

/**
 * Function to get all transactions
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
 * ===================================================================================================================================
 *  Withdrawal Request Functions
 * ===================================================================================================================================
 */

/**
 * Function to get all withdrawal requests
 */
export const getWithdrawalRequests = (): WithdrawalRequest[] => {
  const requestsString = localStorage.getItem(localStorageKeys.withdrawalRequests);
  if (!requestsString) return [];
  return JSON.parse(requestsString);
};

/**
 * Function to create a withdrawal request
 */
export const createWithdrawalRequest = (request: any): WithdrawalRequest => {
  const requests = getWithdrawalRequests();
  const newRequest = {
    id: uuidv4(),
    ...request,
    status: "pending",
    votes: [],
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify([...requests, newRequest]));
  return newRequest;
};

/**
 * Function to vote on a withdrawal request
 */
export const voteOnWithdrawalRequest = (requestId: string, vote: 'approve' | 'reject'): WithdrawalRequest | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const requests = getWithdrawalRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) return null;
  
  // Check if user has already voted
  const existingVoteIndex = request.votes.findIndex(v => v.userId === currentUser.id);
  if (existingVoteIndex >= 0) {
    // Update existing vote
    request.votes[existingVoteIndex].vote = vote;
    request.votes[existingVoteIndex].votedAt = new Date().toISOString();
  } else {
    // Add new vote
    request.votes.push({
      userId: currentUser.id,
      vote,
      votedAt: new Date().toISOString()
    });
  }
  
  // Save the updated request
  const updatedRequests = requests.map(r => r.id === requestId ? request : r);
  localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(updatedRequests));
  
  return request;
};

/**
 * Function to update withdrawal request status
 */
export const updateWithdrawalRequestsStatus = (): void => {
  const requests = getWithdrawalRequests();
  let updated = false;
  
  const updatedRequests = requests.map(request => {
    // Check if a pending request has expired
    if (request.status === "pending" && new Date(request.deadline) < new Date()) {
      updated = true;
      return { ...request, status: "expired" };
    }
    return request;
  });
  
  if (updated) {
    localStorage.setItem(localStorageKeys.withdrawalRequests, JSON.stringify(updatedRequests));
  }
};

/**
 * Function to ping group members for vote
 */
export const pingGroupMembersForVote = (requestId: string): void => {
  // Implementation would go here in a real application
  console.log(`Pinging members for vote on request ${requestId}`);
};

/**
 * ===================================================================================================================================
 *  Statistics Functions
 * ===================================================================================================================================
 */

/**
 * Function to get app statistics
 */
export const getStatistics = (): AppStats => {
  const statsString = localStorage.getItem(localStorageKeys.appStats);
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

/**
 * Helper to validate dates
 */
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

/**
 * Function to initialize local storage with default values
 */
export const initializeLocalStorage = (): void => {
  // Initialize any required localStorage items
  // This would be implemented in a real application
};
