import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback
} from "react";
import { v4 as uuidv4 } from 'uuid';
import { monnifyAPI } from "@/services/monnifyService";
import { toast } from "sonner";
import { markNotificationAsRead as markNotificationAsReadService } from "@/services/localStorage";

// Define the types for user preferences
interface UserPreferences {
  darkMode: boolean;
  anonymousContributions: boolean;
  notificationsEnabled?: boolean;
}

// Define the types for a notification
interface Notification {
  id: string;
  type: 'contribution' | 'general' | 'reminder';
  message: string;
  timestamp: string;
  isRead: boolean;
  read?: boolean;
  relatedId?: string;
  createdAt?: string;
}

// Define the types for virtual account
interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  accountName: string;
  bankCode: string;
}

// Define the types for a user
interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  phoneNumber?: string;
  walletBalance: number;
  preferences: UserPreferences;
  notifications: Notification[];
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  profileImage?: string;
  virtualAccount?: VirtualAccount;
  bvn?: string;
  nin?: string;
  username?: string;
  pin?: string;
}

// Define the types for the context value
interface AppContextValue {
  currentUser: User | null;
  users: User[];
  groups: any[];
  isLoading: boolean;
  refreshData: () => void;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  
  // Additional properties needed by components
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => void;
  updateProfile: (data: any) => void;
  contributions: any[];
  transactions: any[];
  withdrawalRequests: any[];
  getVirtualAccountTransactions: () => Promise<any[]>;
  contribute: (id: string, amount: number) => void;
  requestWithdrawal: (id: string, amount: number) => Promise<boolean>;
  vote: (id: string, vote: 'approve' | 'reject') => void;
  getShareLink: (id: string) => string;
  isGroupCreator: (groupId: string) => boolean;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  createVirtualAccount: () => Promise<boolean>;
  updateKYCDetails: (data: {bvn?: string, nin?: string}) => Promise<boolean>;
  initiateTransfer: (data: any) => Promise<boolean>;
  getSupportedBanks: () => Promise<any[]>;
  createNewContribution: (data: any) => Promise<any>;
  stats: any;
  depositToUserAsAdmin: (userId: string, amount: number) => Promise<any>;
  pauseUserAsAdmin: (userId: string) => Promise<any>;
  activateUserAsAdmin: (userId: string) => Promise<any>;
  shareToContacts: () => void;
  getUserByEmail: (email: string) => User | null;
  getUserByPhone: (phone: string) => User | null;
}

// Create the context
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Create a custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

// Also export with the name useApp to fix the imports across the codebase
export const useApp = useAppContext;

// Create the provider component
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contributions, setContributions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalContributions: 0,
    totalTransactions: 0,
    totalAmount: 0,
    activeRequests: 0
  });

  // Load data from localStorage on component mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedUsers = localStorage.getItem('users');
    const storedGroups = localStorage.getItem('groups');
    const storedContributions = localStorage.getItem('contributions');
    const storedTransactions = localStorage.getItem('transactions');
    const storedWithdrawalRequests = localStorage.getItem('withdrawalRequests');
    const storedStats = localStorage.getItem('stats');

    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing current user:", error);
        localStorage.removeItem('currentUser');
      }
    }
    
    if (storedUsers) {
      try {
        setUsers(JSON.parse(storedUsers));
      } catch (error) {
        console.error("Error parsing users:", error);
      }
    }
    
    if (storedGroups) {
      try {
        setGroups(JSON.parse(storedGroups));
      } catch (error) {
        console.error("Error parsing groups:", error);
      }
    }
    
    if (storedContributions) {
      try {
        setContributions(JSON.parse(storedContributions));
      } catch (error) {
        console.error("Error parsing contributions:", error);
      }
    }
    
    if (storedTransactions) {
      try {
        setTransactions(JSON.parse(storedTransactions));
      } catch (error) {
        console.error("Error parsing transactions:", error);
      }
    }
    
    if (storedWithdrawalRequests) {
      try {
        setWithdrawalRequests(JSON.parse(storedWithdrawalRequests));
      } catch (error) {
        console.error("Error parsing withdrawal requests:", error);
      }
    }
    
    if (storedStats) {
      try {
        setStats(JSON.parse(storedStats));
      } catch (error) {
        console.error("Error parsing stats:", error);
      }
    }
    
    setIsLoading(false);
  }, []);

  // Function to refresh data from localStorage
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    
    // Load data from localStorage
    const storedUser = localStorage.getItem('currentUser');
    const storedUsers = localStorage.getItem('users');
    const storedGroups = localStorage.getItem('groups');
    const storedContributions = localStorage.getItem('contributions');
    const storedTransactions = localStorage.getItem('transactions');
    const storedWithdrawalRequests = localStorage.getItem('withdrawalRequests');
    const storedStats = localStorage.getItem('stats');

    try {
      // Load stored data
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          
          // If user has a virtual account, check for new transactions from Monnify
          if (parsedUser.virtualAccount) {
            const accountReference = `user_${parsedUser.id}`;
            const monnifyTransactions = await monnifyAPI.getTransactions(accountReference);
            
            // Calculate total deposits that should be added to wallet balance
            const totalDeposits = monnifyTransactions
              .filter(tx => tx.paymentStatus === 'PAID')
              .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
            
            // Only update if there are deposits
            if (totalDeposits > 0) {
              // Check if we need to update the wallet balance
              const currentBalance = parsedUser.walletBalance || 0;
              
              // For simplicity, we'll just set the balance to match total deposits
              // In a real app, we would track which deposits were already processed
              if (totalDeposits > currentBalance) {
                const updatedUser = {
                  ...parsedUser,
                  walletBalance: totalDeposits
                };
                
                setCurrentUser(updatedUser);
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                
                // Also update in the users array
                if (storedUsers) {
                  const parsedUsers = JSON.parse(storedUsers);
                  const updatedUsers = parsedUsers.map((user: User) => 
                    user.id === updatedUser.id ? updatedUser : user
                  );
                  
                  setUsers(updatedUsers);
                  localStorage.setItem('users', JSON.stringify(updatedUsers));
                }
              }
            }
          }
        } catch (error) {
          console.error("Error parsing current user:", error);
          localStorage.removeItem('currentUser');
        }
      }
      
      // Load other data
      if (storedUsers) {
        try {
          setUsers(JSON.parse(storedUsers));
        } catch (error) {
          console.error("Error parsing users:", error);
        }
      }
      
      if (storedGroups) {
        try {
          setGroups(JSON.parse(storedGroups));
        } catch (error) {
          console.error("Error parsing groups:", error);
        }
      }
      
      if (storedContributions) {
        try {
          setContributions(JSON.parse(storedContributions));
        } catch (error) {
          console.error("Error parsing contributions:", error);
        }
      }
      
      if (storedTransactions) {
        try {
          setTransactions(JSON.parse(storedTransactions));
        } catch (error) {
          console.error("Error parsing transactions:", error);
        }
      }
      
      if (storedWithdrawalRequests) {
        try {
          setWithdrawalRequests(JSON.parse(storedWithdrawalRequests));
        } catch (error) {
          console.error("Error parsing withdrawal requests:", error);
        }
      }
      a
      if (storedStats) {
        try {
          setStats(JSON.parse(storedStats));
        } catch (error) {
          console.error("Error parsing stats:", error);
        }
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to update user preferences
  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        preferences: {
          ...currentUser.preferences,
          ...newPreferences,
        },
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      // Update in users array as well
      const updatedUsers = users.map(user =>
        user.id === updatedUser.id ? updatedUser : user
      );
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }
  };

  // Function to update user profile
  const updateProfile = (userData: Partial<User>) => {
    if (!currentUser) return;
    
    const updatedUser = {
      ...currentUser,
      ...userData,
      updatedAt: new Date().toISOString()
    };
    
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    // Update in users array as well
    const updatedUsers = users.map(user =>
      user.id === updatedUser.id ? updatedUser : user
    );
    setUsers(updatedUsers);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  };

  // Function to mark a notification as read
  const markNotificationAsRead = (notificationId: string) => {
    markNotificationAsReadService(notificationId);
    refreshData(); // Refresh data after marking notification as read
  };

  /**
   * Create a virtual account for the current user
   */
  const createVirtualAccount = async (): Promise<boolean> => {
    try {
      if (!currentUser) {
        toast.error("You need to be logged in to create a virtual account");
        return false;
      }

      // Check if user has required fields
      if (!currentUser.firstName) {
        toast.error("Your profile information is incomplete");
        return false;
      }

      console.log("Creating virtual account for user", currentUser.id);
      
      try {
        const result = await monnifyAPI.createVirtualAccount({
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName || "",
          email: currentUser.email,
          bvn: currentUser.bvn,
          nin: currentUser.nin
        });
  
        if (result && result.accounts && result.accounts.length > 0) {
          // Get the first account (we're using getAllAvailableBanks: true in the request)
          const firstAccount = result.accounts[0];
          
          // Update the current user with the new virtual account
          const updatedUser = {
            ...currentUser,
            virtualAccount: {
              accountNumber: firstAccount.accountNumber,
              bankName: firstAccount.bankName,
              accountName: firstAccount.accountName,
              bankCode: firstAccount.bankCode,
            }
          };
          
          setCurrentUser(updatedUser);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          
          // Update in users array
          const updatedUsers = users.map(user => 
            user.id === currentUser.id ? updatedUser : user
          );
          setUsers(updatedUsers);
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          
          toast.success("Virtual account created successfully");
          return true;
        } else {
          toast.error("Could not create virtual account - incomplete response");
          return false;
        }
      } catch (error: any) {
        console.error("Error creating virtual account:", error);
        toast.error(error.message || "Failed to create virtual account. Please try again later.");
        return false;
      }
    } catch (error) {
      console.error("Error creating virtual account:", error);
      toast.error("Failed to create virtual account. Please try again later.");
      return false;
    }
  };

  /**
   * Update user's KYC details (BVN/NIN)
   */
  const updateKYCDetails = async (data: {bvn?: string, nin?: string}): Promise<boolean> => {
    try {
      if (!currentUser) {
        return false;
      }
      
      // In a real app, this would validate with the Monnify API
      // For demo purposes, we'll just update the local user
      const updatedUser = {
        ...currentUser,
        bvn: data.bvn || currentUser.bvn,
        nin: data.nin || currentUser.nin
      };
      
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Update in users array
      const updatedUsers = users.map(user => 
        user.id === currentUser.id ? updatedUser : user
      );
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));
      
      return true;
    } catch (error) {
      console.error("Error updating KYC details:", error);
      return false;
    }
  };

  /**
   * Get transactions for user's virtual account
   */
  const getVirtualAccountTransactions = async (): Promise<any[]> => {
    try {
      if (!currentUser || !currentUser.virtualAccount) {
        return [];
      }
      
      const accountReference = `user_${currentUser.id}`;
      const transactions = await monnifyAPI.getTransactions(accountReference);
      
      // Check for new deposits to update wallet balance
      if (transactions && transactions.length > 0) {
        // Calculate total deposits
        const totalDeposits = transactions
          .filter(tx => tx.paymentStatus === 'PAID')
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        
        // Update wallet balance if new deposits found
        if (totalDeposits > 0 && totalDeposits > (currentUser.walletBalance || 0)) {
          const updatedUser = {
            ...currentUser,
            walletBalance: totalDeposits
          };
          
          setCurrentUser(updatedUser);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          
          // Update in users array
          const updatedUsers = users.map(user => 
            user.id === currentUser.id ? updatedUser : user
          );
          setUsers(updatedUsers);
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          
          // Show success toast about the deposit
          toast.success(`Your account has been credited with ₦${totalDeposits.toLocaleString()}`);
        }
      }
      
      return transactions;
    } catch (error) {
      console.error("Error getting transactions:", error);
      return [];
    }
  };

  /**
   * Initiate a transfer from wallet to bank account
   */
  const initiateTransfer = async (params: {
    amount: number;
    recipientAccountNumber: string;
    recipientBankCode: string;
    recipientName: string;
    narration?: string;
  }): Promise<boolean> => {
    try {
      if (!currentUser) {
        return false;
      }
      
      if (currentUser.walletBalance < params.amount) {
        throw new Error("Insufficient balance");
      }
      
      // Generate a reference
      const reference = `transfer_${uuidv4()}`;
      
      // Make the transfer request
      const result = await monnifyAPI.initiateTransfer({
        amount: params.amount,
        recipientAccountNumber: params.recipientAccountNumber,
        recipientBankCode: params.recipientBankCode,
        recipientName: params.recipientName,
        reference,
        narration: params.narration || `Transfer from ${currentUser.name}`
      });
      
      if (result) {
        // Deduct from wallet balance (in a real app, this would happen based on a webhook)
        const updatedUser = {
          ...currentUser,
          walletBalance: currentUser.walletBalance - params.amount
        };
        
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        // Update in users array
        const updatedUsers = users.map(user => 
          user.id === currentUser.id ? updatedUser : user
        );
        setUsers(updatedUsers);
        localStorage.setItem('users', JSON.stringify(updatedUsers));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error initiating transfer:", error);
      return false;
    }
  };

  /**
   * Get list of supported banks
   */
  const getSupportedBanks = async (): Promise<any[]> => {
    try {
      const banks = await monnifyAPI.getBanks();
      return banks;
    } catch (error) {
      console.error("Error getting supported banks:", error);
      toast.error("Could not fetch supported banks. Please try again later.");
      return [];
    }
  };

  // Stub implementation for contribute
  const contribute = (id: string, amount: number) => {
    console.log(`Contributing ${amount} to ${id}`);
  };

  // Stub implementation for requestWithdrawal
  const requestWithdrawal = async (id: string, amount: number): Promise<boolean> => {
    console.log(`Requesting withdrawal of ${amount} from ${id}`);
    return true;
  };

  // Stub implementation for vote
  const vote = (id: string, vote: 'approve' | 'reject') => {
    console.log(`Voting ${vote} on ${id}`);
  };

  // Stub implementation for getShareLink
  const getShareLink = (id: string): string => {
    return `https://collectipay.com/share/${id}`;
  };

  // Stub implementation for isGroupCreator
  const isGroupCreator = (groupId: string): boolean => {
    return true;
  };

  // Stub implementation for pingMembersForVote
  const pingMembersForVote = (requestId: string) => {
    console.log(`Pinging members for vote on ${requestId}`);
  };

  // Stub implementation for getReceipt
  const getReceipt = (transactionId: string): any => {
    return { id: transactionId, date: new Date().toISOString() };
  };

  // Stub implementation for createNewContribution
  const createNewContribution = async (data: any): Promise<any> => {
    console.log(`Creating new contribution with data:`, data);
    return { id: uuidv4(), ...data };
  };

  // Stub implementation for depositToUserAsAdmin
  const depositToUserAsAdmin = async (userId: string, amount: number): Promise<any> => {
    console.log(`Admin depositing ${amount} to user ${userId}`);
    return true;
  };

  // Stub implementation for pauseUserAsAdmin
  const pauseUserAsAdmin = async (userId: string): Promise<any> => {
    console.log(`Admin pausing user ${userId}`);
    return true;
  };

  // Stub implementation for activateUserAsAdmin
  const activateUserAsAdmin = async (userId: string): Promise<any> => {
    console.log(`Admin activating user ${userId}`);
    return true;
  };

  // Stub implementation for shareToContacts
  const shareToContacts = () => {
    console.log(`Sharing to contacts`);
  };

  // Function to get user by email
  const getUserByEmail = (email: string): User | null => {
    const user = users.find(u => u.email === email);
    return user || null;
  };

  // Function to get user by phone
  const getUserByPhone = (phone: string): User | null => {
    const user = users.find(u => u.phone === phone);
    return user || null;
  };

  // Update the context value to include all required properties
  const value = {
    currentUser,
    users,
    groups,
    isLoading,
    refreshData,
    updatePreferences,
    markNotificationAsRead,
    
    // Map additional properties needed by components
    user: currentUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === "admin",
    logout: () => {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
    },
    updateProfile,
    // Add implementations for virtual account features
    createVirtualAccount,
    updateKYCDetails,
    getVirtualAccountTransactions,
    initiateTransfer,
    getSupportedBanks,
    // Add remaining required properties
    contributions,
    transactions,
    withdrawalRequests,
    contribute,
    requestWithdrawal,
    vote,
    getShareLink,
    isGroupCreator,
    pingMembersForVote,
    getReceipt,
    createNewContribution,
    stats,
    depositToUserAsAdmin,
    pauseUserAsAdmin,
    activateUserAsAdmin,
    shareToContacts,
    getUserByEmail,
    getUserByPhone
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
