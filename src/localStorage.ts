// First import any required functions from the original file to fix the errors
import { getCurrentUser, getUsers, getContributions } from "@/services/localStorage";
import { isValid } from "date-fns";

// Add the missing function to localStorage.ts
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

// Helper function to get contribution by account number
export const getContributionByAccountNumber = (accountNumber: string) => {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return null;
    
    const contributions = JSON.parse(contributionsString);
    return contributions.find(c => c.accountNumber === accountNumber) || null;
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
    
    contributions.forEach(contribution => {
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
  password: string;
  walletBalance: number;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled?: boolean;  // Add missing field
  };
  role: 'user' | 'admin';
  accountNumber?: string;
  accountName?: string;
  verified: boolean;
  reservedAccount?: any;
  invoices?: any[];
  cardTokens?: any[];
  notifications?: any[];
  // Add missing fields
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImage?: string;
  status?: string;
  createdAt?: string;
}
