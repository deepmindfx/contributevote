
// Import only what we need from date-fns
import { isValid } from "date-fns";

// Add the missing function to localStorage.ts
export const verifyUserWithOTP = (userId: string): void => {
  try {
    // Get users from localStorage
    const usersString = localStorage.getItem('users');
    if (!usersString) return;
    
    const users = JSON.parse(usersString);
    const index = users.findIndex((u: any) => u.id === userId);
    
    if (index >= 0) {
      users[index].verified = true;
      localStorage.setItem('users', JSON.stringify(users));
      
      // If this is the current user, update that too
      const currentUserString = localStorage.getItem('currentUser');
      if (currentUserString) {
        const currentUser = JSON.parse(currentUserString);
        if (currentUser && currentUser.id === userId) {
          currentUser.verified = true;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
      }
    }
  } catch (error) {
    console.error("Error in verifyUserWithOTP:", error);
  }
};

// DO NOT import functions from the original file - that's causing circular reference
// Instead, define the addTransaction function directly
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

// Helper function to get contribution by account number
export const getContributionByAccountNumber = (accountNumber: string) => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return null;
    
    const contributions = JSON.parse(contributionsString);
    return contributions.find((c: any) => c.accountNumber === accountNumber) || null;
  } catch (error) {
    console.error("Error in getContributionByAccountNumber:", error);
    return null;
  }
};

// Get the current user from localStorage
export const getCurrentUser = (): User | null => {
  try {
    const userString = localStorage.getItem('currentUser');
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// Get all users from localStorage
export const getUsers = (): User[] => {
  try {
    const usersString = localStorage.getItem('users');
    return usersString ? JSON.parse(usersString) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

// Get all contributions from localStorage
export const getContributions = (): Contribution[] => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
};

// Helper to ensure account number is displayed correctly
export const ensureAccountNumberDisplay = () => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return;
    
    const contributions = JSON.parse(contributionsString);
    let updated = false;
    
    contributions.forEach((contribution: any) => {
      // If no account number exists, create a unique one
      if (!contribution.accountNumber) {
        // Generate a unique 10-digit account number starting with 60
        contribution.accountNumber = `60${Math.floor(10000000 + Math.random() * 90000000)}`;
        updated = true;
        console.log(`Generated new account number ${contribution.accountNumber} for ${contribution.name}`);
      }
    });
    
    if (updated) {
      localStorage.setItem('contributions', JSON.stringify(contributions));
      console.log('Updated contribution account numbers:', contributions);
    }
    
    // For debugging - return the contributions
    return contributions;
  } catch (error) {
    console.error("Error ensuring account numbers:", error);
    return null;
  }
};

// Add mark all notifications as read function
export const markAllNotificationsAsRead = () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    currentUser.notifications = currentUser.notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

// Add a re-export of ensureAccountNumberDisplay in services/localStorage.ts
export const reExportEnsureAccountNumberDisplay = () => {
  // This function is just to get TypeScript to recognize we're exporting ensureAccountNumberDisplay
  // This isn't actually used, but it forces the compiler to include the export
  return ensureAccountNumberDisplay;
};

// Fix the User interface to include all required fields
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  walletBalance: number;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled?: boolean;
  };
  role: 'user' | 'admin' | 'paused';
  accountNumber?: string;
  accountName?: string;
  verified: boolean;
  reservedAccount?: any;
  invoices?: any[];
  cardTokens?: any[];
  notifications?: any[];
  // Add missing fields that are used in the codebase
  phone?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImage?: string;
  status?: string;
  createdAt?: string;
  pin?: string;
}

// Add missing interface for Contribution
export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  category: "personal" | "family" | "community" | "business" | "event" | "education" | "other";
  frequency: "daily" | "weekly" | "monthly" | "one-time";
  contributionAmount: number;
  startDate: string;
  endDate?: string;
  deadline?: string;
  creatorId: string;
  members: string[];
  contributors: any[];
  createdAt: string;
  status?: "active" | "completed" | "expired";
  visibility?: "public" | "private" | "invite-only";
  privacy?: string;
  memberRoles?: string;
  votingThreshold?: number;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  accountReference?: string;
  accountDetails?: any; // Add field for Monnify account details
}

// Add missing Transaction interface
export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "transfer" | "payment" | "vote";
  amount: number;
  narration?: string;
  status?: "pending" | "successful" | "failed" | "completed";
  reference?: string;
  userId: string;
  toUserId?: string;
  contributionId?: string;
  createdAt: string;
  paymentMethod?: string;
  metadata?: any;
  metaData?: any; // Some places use metaData others use metadata
  description?: string;
  anonymous?: boolean;
}
