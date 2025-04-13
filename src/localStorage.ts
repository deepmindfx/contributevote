
// Import only what we need from date-fns
import { isValid } from "date-fns";

// Basic helper functions that don't require imports from other modules
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

// Helper function for re-export
export const reExportEnsureAccountNumberDisplay = () => {
  return ensureAccountNumberDisplay;
};

// Direct localStorage access functions that don't depend on modules
export const getCurrentUser = () => {
  try {
    const userString = localStorage.getItem('currentUser');
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const getUsers = () => {
  try {
    const usersString = localStorage.getItem('users');
    return usersString ? JSON.parse(usersString) : [];
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
};

export const getContributions = () => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
};

export const markAllNotificationsAsRead = () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.notifications) return;
    
    currentUser.notifications = currentUser.notifications.map((notification: any) => ({
      ...notification,
      read: true
    }));
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

// Re-export the types from types.ts
export type { User, Transaction, Contribution } from './services/localStorage/types';
