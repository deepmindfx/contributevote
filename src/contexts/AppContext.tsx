
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  Contribution, 
  WithdrawalRequest, 
  Transaction,
  Stats,
  getCurrentUser,
  getContributions,
  getUserContributions,
  getWithdrawalRequests,
  getTransactions,
  getUsers,
  getStatistics,
  getUserByEmail,
  getUserByPhone,
  initializeLocalStorage,
  updateWithdrawalRequestsStatus
} from '@/services/localStorage';
import { toast } from 'sonner';
import { AppContextType } from './types';
import * as contributionActions from './contributionActions';
import * as userActions from './userActions';
import * as withdrawalActions from './withdrawalActions';
import * as transactionActions from './transactionActions';

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const [users, setUsers] = useState<User[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({} as Stats);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Effect for dark mode
  useEffect(() => {
    if (user?.preferences?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences?.darkMode]);

  useEffect(() => {
    initializeLocalStorage();
    refreshData();
  }, []);

  // New effect to check for expired withdrawal requests
  useEffect(() => {
    if (isAuthenticated) {
      const checkExpiredRequests = () => {
        updateWithdrawalRequestsStatus();
        refreshData();
      };
      
      // Run once at start
      checkExpiredRequests();
      
      // Then set interval to check every minute
      const interval = setInterval(checkExpiredRequests, 60000);
      
      // Clear interval on unmount
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const refreshData = () => {
    const currentUser = getCurrentUser();
    // If you pass currentUser to setUser, you need to check if it's null
    if (currentUser) {
      setUser(currentUser);
    } else {
      // Handle case where user is not logged in
      setUser({} as User);
    }
    setUsers(getUsers());
    
    // Check if user is authenticated
    const isUserAuthenticated = !!currentUser && !!currentUser.id;
    setIsAuthenticated(isUserAuthenticated);
    
    if (isUserAuthenticated) {
      // Only get contributions for this user if authenticated
      setContributions(getUserContributions(currentUser.id));
      setWithdrawalRequests(getWithdrawalRequests());
      setTransactions(getTransactions());
      setStats(getStatistics());
      setIsAdmin(currentUser?.role === 'admin');
    } else {
      // Reset data if not authenticated
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({} as Stats);
      setIsAdmin(false);
    }
  };

  // Map all the actions to the context methods
  const createNewContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => {
    contributionActions.createNewContribution(contribution, refreshData);
  };

  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    contributionActions.contribute(contributionId, amount, anonymous, user.walletBalance, refreshData);
  };

  const contributeViaAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
    contributionActions.contributeViaAccountNumber(accountNumber, amount, contributorInfo, anonymous, refreshData);
  };

  const requestWithdrawal = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => {
    withdrawalActions.requestWithdrawal(request, user, contributions, refreshData);
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    withdrawalActions.vote(requestId, vote, refreshData);
  };

  const updateProfile = (userData: Partial<User>) => {
    userActions.updateProfile(userData, refreshData);
  };

  const updateUserAsAdmin = (userId: string, userData: Partial<User>) => {
    userActions.updateUserAsAdmin(userId, userData, isAdmin, refreshData);
  };

  const depositToUserAsAdmin = (userId: string, amount: number) => {
    userActions.depositToUserAsAdmin(userId, amount, isAdmin, refreshData);
  };

  const pauseUserAsAdmin = (userId: string) => {
    userActions.pauseUserAsAdmin(userId, isAdmin, refreshData);
  };

  const activateUserAsAdmin = (userId: string) => {
    userActions.activateUserAsAdmin(userId, isAdmin, refreshData);
  };

  const logout = () => {
    userActions.logoutUser(refreshData);
  };

  const shareToContacts = (contributionId: string, recipients: string[]) => {
    contributionActions.shareToContacts(contributionId, recipients, contributions, getUserByEmail, getUserByPhone, refreshData);
  };

  const pingMembersForVote = (requestId: string) => {
    withdrawalActions.pingMembersForVote(requestId);
  };

  const getReceipt = (transactionId: string) => {
    return transactionActions.getReceipt(transactionId);
  };

  const verifyUser = (userId: string) => {
    userActions.verifyUser(userId, refreshData);
  };

  const isGroupCreator = (contributionId: string): boolean => {
    return contributionActions.isGroupCreator(contributionId, user.id, contributions);
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
      getShareLink: contributionActions.getShareLink,
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
