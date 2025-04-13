
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { useContribution } from './ContributionContext'; 
import { useAdmin } from './AdminContext';
import { initializeLocalStorage } from '@/services/localStorage';
import { ensureAccountNumberDisplay } from '@/localStorage';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
    initializeLocalStorage();
    refreshData();
    
    // Add this call to ensure account numbers are displayed
    ensureAccountNumberDisplay();
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
      ensureAccountNumberDisplay();
      
    } catch (error) {
      console.error("Error in refreshData:", error);
    }
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
