
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { useContribution } from './ContributionContext';
import { toast } from 'sonner';

interface AppContextType {
  isReady: boolean;
  isLoading: boolean;
  user: any;
  contributions: any[];
  transactions: any[];
  withdrawalRequests: any[];
  stats: any;
  darkMode: boolean;
  toggleDarkMode: () => void;
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
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize darkMode from localStorage or system preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      return savedMode === 'true';
    } else {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  });

  // Effect to apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

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
      darkMode,
      toggleDarkMode,
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
