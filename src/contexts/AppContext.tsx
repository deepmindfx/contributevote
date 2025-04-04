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
  createContribution,
  contributeToGroup,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  updateUserBalance,
  generateShareLink,
  initializeLocalStorage,
  updateUser,
  updateUserById,
  pauseUser,
  activateUser,
  depositToUser,
  logoutUser,
} from '@/services/localStorage';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface AppContextType {
  user: User;
  users: User[];
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: Stats;
  refreshData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  updateProfile: (userData: Partial<User>) => void;
  updateUserAsAdmin: (userId: string, userData: Partial<User>) => void;
  depositToUserAsAdmin: (userId: string, amount: number) => void;
  pauseUserAsAdmin: (userId: string) => void;
  activateUserAsAdmin: (userId: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  logout: () => void;
}

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

  const refreshData = () => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
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

  const logout = () => {
    logoutUser();
    refreshData();
    toast.success("You have been logged out successfully");
  };

  const createNewContribution = (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => {
    try {
      createContribution(contribution);
      refreshData();
      toast.success('Contribution group created successfully!');
    } catch (error) {
      toast.error('Failed to create contribution group');
      console.error(error);
    }
  };

  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    try {
      if (user.walletBalance < amount) {
        toast.error('Insufficient funds in your wallet');
        return;
      }
      
      contributeToGroup(contributionId, amount, anonymous);
      refreshData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const requestWithdrawal = (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes'>) => {
    try {
      // Check if user has set up a PIN
      if (!user.pin) {
        toast.error('Please set up a transaction PIN in settings before requesting withdrawals');
        return;
      }
      
      const contribution = contributions.find(c => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      if (contribution.currentAmount < request.amount) {
        toast.error('Requested amount exceeds available funds');
        return;
      }
      
      createWithdrawalRequest(request);
      refreshData();
      toast.success('Withdrawal request submitted for voting');
    } catch (error) {
      toast.error('Failed to create withdrawal request');
      console.error(error);
    }
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      voteOnWithdrawalRequest(requestId, vote);
      refreshData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toast.error('Failed to submit vote');
      console.error(error);
    }
  };

  const getShareLink = (contributionId: string) => {
    return generateShareLink(contributionId);
  };
  
  const updateProfile = (userData: Partial<User>) => {
    try {
      updateUser(userData);
      refreshData();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  // Admin functions
  const updateUserAsAdmin = (userId: string, userData: Partial<User>) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      updateUserById(userId, userData);
      refreshData();
      toast.success('User updated successfully');
    } catch (error) {
      toast.error('Failed to update user');
      console.error(error);
    }
  };

  const depositToUserAsAdmin = (userId: string, amount: number) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      depositToUser(userId, amount);
      refreshData();
      toast.success(`Successfully deposited ₦${amount.toLocaleString()} to user`);
    } catch (error) {
      toast.error('Failed to deposit funds');
      console.error(error);
    }
  };

  const pauseUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      pauseUser(userId);
      refreshData();
      toast.success('User paused successfully');
    } catch (error) {
      toast.error('Failed to pause user');
      console.error(error);
    }
  };

  const activateUserAsAdmin = (userId: string) => {
    try {
      if (!isAdmin) {
        toast.error('Unauthorized access');
        return;
      }

      activateUser(userId);
      refreshData();
      toast.success('User activated successfully');
    } catch (error) {
      toast.error('Failed to activate user');
      console.error(error);
    }
  };
  
  const shareToContacts = (contributionId: string, recipients: string[]) => {
    try {
      // In a real app, this would send SMS or emails
      // For now we'll simulate it with a toast notification
      const contribution = contributions.find(c => c.id === contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
      
      // Log share event to console - in a real app we'd send actual notifications
      console.log(`Sharing contribution "${contribution.name}" to ${recipients.length} recipients`);
      console.log(`Share URL: ${shareUrl}`);
      console.log(`Recipients: ${recipients.join(', ')}`);
      
      toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
      
      // In a real app we would store the share event
      refreshData();
    } catch (error) {
      toast.error('Failed to share contribution');
      console.error(error);
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
