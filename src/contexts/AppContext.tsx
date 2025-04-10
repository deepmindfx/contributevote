import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback
} from "react";
import { v4 as uuidv4 } from 'uuid';
import {
  sendSMS,
  sendOTPSMS,
  generateOTP,
  storeOTP,
  verifyOTP
} from "@/services/smsBulkService";
import { monnifyAPI } from "@/services/monnifyService";
import { toast } from "sonner";

// Define the types for user preferences
interface UserPreferences {
  darkMode: boolean;
  anonymousContributions: boolean;
  notificationsEnabled?: boolean; // Added to fix errors in UserSettingsForm
}

// Define the types for a notification
interface Notification {
  id: string;
  type: 'contribution' | 'general' | 'reminder';
  message: string;
  timestamp: string;
  isRead: boolean;
  read?: boolean; // Added for backward compatibility
  relatedId?: string; // Added to fix errors in Dashboard
  createdAt?: string; // Added to fix errors in Dashboard
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
  phoneNumber?: string; // Added to resolve type errors
  walletBalance: number;
  preferences: UserPreferences;
  notifications: Notification[];
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
  createdAt: string;
  verified: boolean;
  profileImage?: string;
  updatedAt?: string;
  virtualAccount?: VirtualAccount;
  bvn?: string; // Bank Verification Number
  nin?: string; // National Identification Number
  username?: string; // Added to fix errors in UserSettingsForm
  pin?: string; // Added to fix errors in UserSettingsForm
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
  sendVerificationSMS: (userId: string, phoneNumber: string) => Promise<{success: boolean, error?: string}>;
  verifyUserWithOTPCode: (userId: string, otp: string) => boolean;
  
  // Additional properties needed by components
  user?: User | null;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  logout?: () => void;
  updateProfile?: (data: any) => void;
  contributions?: any[];
  transactions?: any[];
  withdrawalRequests?: any[];
  getVirtualAccountTransactions?: () => Promise<any[]>;
  contribute?: (id: string, amount: number) => void;
  requestWithdrawal?: (id: string, amount: number) => Promise<boolean>;
  vote?: (id: string, vote: 'approve' | 'reject') => void;
  getShareLink?: (id: string) => string;
  isGroupCreator?: (groupId: string) => boolean;
  pingMembersForVote?: (requestId: string) => void;
  getReceipt?: (transactionId: string) => any;
  createVirtualAccount?: () => Promise<boolean>;
  updateKYCDetails?: (data: {bvn?: string, nin?: string}) => Promise<boolean>;
  initiateTransfer?: (data: any) => Promise<boolean>;
  getSupportedBanks?: () => Promise<any[]>;
  createNewContribution?: (data: any) => Promise<any>;
  stats?: any;
  depositToUserAsAdmin?: (userId: string, amount: number) => Promise<any>;
  pauseUserAsAdmin?: (userId: string) => Promise<any>;
  activateUserAsAdmin?: (userId: string) => Promise<any>;
  shareToContacts?: () => void;
  getUserByEmail?: () => void;
  getUserByPhone?: () => void;
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

  // Load data from localStorage on component mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedUsers = localStorage.getItem('users');
    const storedGroups = localStorage.getItem('groups');

    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }
    if (storedGroups) {
      setGroups(JSON.parse(storedGroups));
    }
    setIsLoading(false);
  }, []);

  // Function to refresh data from localStorage
  const refreshData = useCallback(() => {
    setIsLoading(true);
    const storedUser = localStorage.getItem('currentUser');
    const storedUsers = localStorage.getItem('users');
    const storedGroups = localStorage.getItem('groups');

    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }
    if (storedGroups) {
      setGroups(JSON.parse(storedGroups));
    }
    setIsLoading(false);
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

  // Function to mark a notification as read
  const markNotificationAsRead = (notificationId: string) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        notifications: currentUser.notifications.map(notification =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification
        ),
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

  /**
   * Send verification SMS to user
   */
  const sendVerificationSMS = async (userId: string, phoneNumber: string): Promise<{success: boolean, error?: string}> => {
    try {
      // Generate an OTP
      const otp = generateOTP();
      
      // Store it for later verification
      storeOTP(userId, otp);
      
      // Send it via SMS
      const smsResult = await sendOTPSMS(phoneNumber, otp);
      
      // Return the SMS sending result
      return smsResult;
    } catch (error) {
      console.error("Failed to send verification SMS:", error);
      return {
        success: false,
        error: "Failed to send verification code. Please try again."
      };
    }
  };

  /**
   * Verify OTP code for a user
   * @param userId User ID
   * @param otp OTP code
   * @returns Whether the OTP is valid
   */
  const verifyUserWithOTPCode = (userId: string, otp: string): boolean => {
    const isVerified = verifyOTP(userId, otp);

    if (isVerified && currentUser) {
      // Update user's verification status
      const updatedUser = {
        ...currentUser,
        verified: true
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      // Update in users array as well
      const updatedUsers = users.map(user =>
        user.id === updatedUser.id ? updatedUser : user
      );
      setUsers(updatedUsers);
      localStorage.setItem('users', JSON.stringify(updatedUsers));

      return true;
    }

    return false;
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
      return await monnifyAPI.getTransactions(accountReference);
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

  // Update the context value to include all required properties
  const value = {
    currentUser,
    users,
    groups,
    isLoading,
    refreshData,
    updatePreferences,
    markNotificationAsRead,
    sendVerificationSMS,
    verifyUserWithOTPCode,
    
    // Map additional properties needed by components
    user: currentUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === "admin",
    logout: () => {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
    },
    // Add implementations for virtual account features
    createVirtualAccount,
    updateKYCDetails,
    getVirtualAccountTransactions,
    initiateTransfer,
    getSupportedBanks,
    // Add stubs for other required properties
    contributions: [],
    transactions: [],
    withdrawalRequests: []
    // Other properties would be implemented here
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
