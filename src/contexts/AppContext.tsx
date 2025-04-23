
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { useContribution } from './ContributionContext';
import { toast } from 'sonner';
import { type Transaction } from '@/services/localStorage/types';

interface AppContextType {
  isReady: boolean;
  isLoading: boolean;
  user: any;
  contributions: any[];
  transactions: any[];
  withdrawalRequests: any[];
  stats: any;
  refreshData: () => void;
  createNewContribution: (contribution: any) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: any, anonymous?: boolean) => void;
  getShareLink: (contributionId: string) => string;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  getReceipt: (transactionId: string) => any;
  isGroupCreator: (contributionId: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const { user: authUser, isAuthenticated } = useAuth();
  const { user: userDetails, refreshUserData } = useUser();
  const {
    contributions,
    transactions,
    withdrawalRequests,
    stats,
    refreshContributionData,
    isGroupCreator,
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    getShareLink,
    shareToContacts,
    getReceipt,
  } = useContribution();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and set up
  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
    
    // Mark as ready after initial loading
    setTimeout(() => {
      setIsReady(true);
      setIsLoading(false);
    }, 1000);
  }, [isAuthenticated]);

  // Refresh all data from various contexts
  const refreshData = () => {
    setIsLoading(true);
    
    try {
      // Refresh user data first
      refreshUserData();
      
      // Then refresh contribution data which might depend on user data
      refreshContributionData();
      
      console.log("App data refreshed");
    } catch (error) {
      console.error("Error refreshing app data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsLoading(false);
    }
  };

  // Combine user details from auth and user contexts
  const combinedUser = {
    ...authUser,
    ...userDetails
  };

  return (
    <AppContext.Provider value={{
      isReady,
      isLoading,
      user: combinedUser,
      contributions,
      transactions,
      withdrawalRequests,
      stats,
      refreshData,
      createNewContribution,
      contribute,
      contributeViaAccountNumber,
      getShareLink,
      shareToContacts,
      getReceipt,
      isGroupCreator
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
