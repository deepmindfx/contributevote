
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  clearAuthToken,
  getAuthToken,
  storeAuthToken,
  getCurrentUser,
  setCurrentUser,
  updateUser as updateLocalStorageUser,
  getUsers,
  getNotifications,
  createNotification,
  markNotificationAsRead,
} from '@/services/localStorage';
import {
  User,
  Contribution,
  WithdrawalRequest,
  Transaction,
  Stats,
  Notification,
} from '@/services/localStorage/types';
import { useContributionData } from './contribution/hooks/useContributionData';
import { useContributionActions } from './contribution/hooks/useContributionActions';
import { useWithdrawalActions } from './contribution/hooks/useWithdrawalActions';

interface AppContextType {
  user: User | null;
  users?: User[];
  isAuthenticated: boolean;
  isAdmin?: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: any) => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  updateProfile?: (userData: Partial<User>) => void;
  refreshData: () => void;
  
  // User management functions
  updateUserAsAdmin?: (userId: string, userData: Partial<User>) => void;
  depositToUserAsAdmin?: (userId: string, amount: number) => void;
  pauseUserAsAdmin?: (userId: string) => void;
  activateUserAsAdmin?: (userId: string) => void;
  getUserByEmail?: (email: string) => User | null;
  getUserByPhone?: (phone: string) => User | null;
  
  // Contribution methods
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: any;
  refreshContributionData: () => void;
  createNewContribution: (contribution: any) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: any, anonymous?: boolean) => void;
  requestWithdrawal: (request: any) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  isGroupCreator: (contributionId: string) => boolean;
  hasUnreadNotifications: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = getAuthToken();
    const storedUser = getCurrentUser();
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);
  
  const login = async (email: string, password: string) => {
    const users = getUsers();
    const foundUser = users.find(
      (u) => u.email === email && u.password === password
    );
    
    if (foundUser) {
      storeAuthToken('fake_token');
      setCurrentUser(foundUser);
      setIsAuthenticated(true);
      setUser(foundUser);
      toast.success(`Welcome back, ${foundUser.name}!`);
      navigate('/dashboard');
      return true;
    } else {
      toast.error('Invalid credentials');
      return false;
    }
  };
  
  const register = async (userData: any) => {
    try {
      const users = getUsers();
      
      // Check if email already exists
      if (users.find((u) => u.email === userData.email)) {
        toast.error('Email already exists');
        return false;
      }
      
      // Create a new user object
      const newUser = {
        id: Math.random().toString(36).substring(2, 15),
        ...userData,
        profilePicture:
          'https://api.dicebear.com/7.x/lorelei/svg?seed=' + userData.name,
        emailVerified: true,
        phoneVerified: false,
        twoFactorAuthEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        role: 'user',
        status: 'active',
        settings: {
          notificationsEnabled: true,
          darkModeEnabled: false,
          language: 'en',
          currency: 'NGN',
        },
        groups: [],
        contributions: [],
        notifications: [],
        verified: false,
        walletBalance: 0,
      };
      
      // Add the new user to the users array
      users.push(newUser);
      
      // Store the updated users array in localStorage
      localStorage.setItem('users', JSON.stringify(users));
      
      // Log in the new user
      storeAuthToken('fake_token');
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      setUser(newUser);
      
      toast.success(`Welcome, ${newUser.name}!`);
      navigate('/dashboard');
      return true;
    } catch (error) {
      toast.error('Registration failed');
      console.error(error);
      return false;
    }
  };
  
  const logout = () => {
    clearAuthToken();
    localStorage.removeItem('currentUser');
    setIsAuthenticated(false);
    setUser(null);
    toast.success('Logged out successfully');
    navigate('/');
  };
  
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setCurrentUser(updatedUser);
      updateLocalStorageUser(updatedUser);
      setUser(updatedUser);
      toast.success('Profile updated successfully');
    }
  };
  
  const refreshData = () => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
  };
  
  // Contribution data and actions
  const {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    checkExpiredRequests,
    isGroupCreator,
    lastRefreshTime,
  } = useContributionData(user, isAuthenticated);
  
  const getUserByEmail = (email: string) => {
    const users = getUsers();
    return users.find((u: any) => u.email === email);
  };
  
  const getUserByPhone = (phone: string) => {
    const users = getUsers();
    return users.find((u: any) => u.phone === phone);
  };
  
  const {
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    getShareLink,
    shareToContacts,
    getReceipt,
  } = useContributionActions(
    user,
    contributions,
    refreshContributionData,
    getUserByEmail,
    getUserByPhone
  );
  
  const { requestWithdrawal, vote, pingMembersForVote } = useWithdrawalActions(
    user,
    contributions,
    refreshContributionData
  );
  
  // Notifications
  const handleCreateNotification = (notification: Omit<Notification, 'id'>) => {
    if (!user) {
      console.error('User not logged in');
      return;
    }
    
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(2, 15),
      ...notification,
      userId: user.id,
      read: false,
      createdAt: new Date().toISOString(),
    };
    
    createNotification(newNotification);
    refreshData();
  };
  
  const handleMarkNotificationAsRead = (notificationId: string) => {
    markNotificationAsRead(notificationId);
    refreshData();
  };
  
  const notifications = user ? getNotifications(user.id) : [];
  const hasUnreadNotifications = notifications.some((n) => !n.read);
  
  const contextValue: AppContextType = {
    user,
    users: getUsers(),
    isAuthenticated,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    register,
    updateUser,
    updateProfile: updateUser,
    refreshData,
    
    // User management
    getUserByEmail,
    getUserByPhone,
    
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
    isGroupCreator,
    hasUnreadNotifications,
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      checkExpiredRequests();
    }
  }, [isAuthenticated, lastRefreshTime, checkExpiredRequests]);
  
  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export { AppContext };
