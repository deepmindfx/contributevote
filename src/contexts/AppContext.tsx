
import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { useUser } from './UserContext';
import { useContribution } from './ContributionContext'; 
import { useAdmin } from './AdminContext';
import { initializeLocalStorage } from '@/services/localStorage';
import { ensureAccountNumberDisplay } from '@/localStorage';
import { hasUnreadNotifications } from '@/services/localStorage/notificationOperations';

// Create a backward compatibility context
interface AppContextType {
  user: any;
  users: any[];
  contributions: any[];
  withdrawalRequests: any[];
  transactions: any[];
  stats: any;
  refreshData: () => void;
  createNewContribution: (contribution: any) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous?: boolean) => void;
  requestWithdrawal: (request: any) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  updateProfile: (userData: any) => void;
  updateUserAsAdmin: (userId: string, userData: any) => void;
  depositToUserAsAdmin: (userId: string, amount: number) => void;
  pauseUserAsAdmin: (userId: string) => void;
  activateUserAsAdmin: (userId: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  logout: () => void;
  getUserByEmail: (email: string) => any | null;
  getUserByPhone: (phone: string) => any | null;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  verifyUser: (userId: string) => void;
  isGroupCreator: (contributionId: string) => boolean;
  // Missing functions that need to be added
  login: (email: string, password: string) => Promise<any>;
  register: (userData: any) => Promise<any>;
  updateUser: (userData: any) => void;
  refreshContributionData: () => void;
  hasUnreadNotifications: (userId: string) => boolean;
}

// Export the context so it can be imported directly
export const AppContext = createContext<AppContextType | undefined>(undefined);

// This is our backward compatibility provider
export function AppProvider({ children }: { children: ReactNode }) {
  const { 
    user, 
    users, 
    isAdmin, 
    isAuthenticated, 
    refreshUserData,
    updateProfile,
    updateUserAsAdmin,
    depositToUserAsAdmin,
    pauseUserAsAdmin,
    activateUserAsAdmin,
    getUserByEmail,
    getUserByPhone,
    verifyUser,
    logout
  } = useUser();

  const {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    requestWithdrawal,
    vote,
    getShareLink,
    shareToContacts,
    pingMembersForVote,
    getReceipt,
    isGroupCreator
  } = useContribution();

  useEffect(() => {
    // Initialize local storage when the app first loads
    try {
      initializeLocalStorage();
      refreshData();
      
      // Add this call to ensure account numbers are displayed
      ensureAccountNumberDisplay();
    } catch (error) {
      console.error("Error in initial load:", error);
    }
  }, []);

  // Combine all refresh functions
  const refreshData = () => {
    // Make sure localStorage is initialized before refreshing data
    try {
      initializeLocalStorage();
      refreshUserData();
      
      // Only refresh contribution data if user is authenticated
      if (isAuthenticated && user?.id) {
        refreshContributionData();
      }
      
      // Ensure account numbers are displayed for contributions
      try {
        ensureAccountNumberDisplay();
      } catch (error) {
        console.info("Non-critical error in ensureAccountNumberDisplay:", error);
      }
      
    } catch (error) {
      console.error("Error in refreshData:", error);
    }
  };

  // Mock auth functions for now - these would be implemented properly
  const login = async (email: string, password: string) => {
    // This would be implemented with actual auth logic
    console.log('Login called with:', email);
    return Promise.resolve({ success: true });
  };

  const register = async (userData: any) => {
    // This would be implemented with actual registration logic
    console.log('Register called with:', userData);
    return Promise.resolve({ success: true });
  };

  const updateUser = (userData: any) => {
    // This would call the appropriate user update function
    updateProfile(userData);
  };

  const checkUnreadNotifications = (userId: string) => {
    return hasUnreadNotifications(userId);
  };

  return (
    <AppContext.Provider value={{
      user,
      users,
      contributions,
      withdrawalRequests,
      transactions,
      stats,
      refreshData,
      createNewContribution,
      contribute,
      contributeViaAccountNumber,
      requestWithdrawal,
      vote,
      getShareLink,
      updateProfile,
      updateUserAsAdmin,
      depositToUserAsAdmin,
      pauseUserAsAdmin,
      activateUserAsAdmin,
      isAdmin,
      isAuthenticated,
      shareToContacts,
      logout,
      getUserByEmail,
      getUserByPhone,
      pingMembersForVote,
      getReceipt,
      verifyUser,
      isGroupCreator,
      // Added missing functions
      login,
      register,
      updateUser,
      refreshContributionData,
      hasUnreadNotifications: checkUnreadNotifications,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
