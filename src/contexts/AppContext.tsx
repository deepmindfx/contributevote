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

// Define the types for user preferences
interface UserPreferences {
  darkMode: boolean;
  anonymousContributions: boolean;
}

// Define the types for a notification
interface Notification {
  id: string;
  type: 'contribution' | 'general' | 'reminder';
  message: string;
  timestamp: string;
  isRead: boolean;
}

// Define the types for a user
interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  walletBalance: number;
  preferences: UserPreferences;
  notifications: Notification[];
  role: "admin" | "user";
  status: "active" | "inactive" | "pending";
  createdAt: string;
  verified: boolean;
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

  // Update the context value to include the updated function
  const value = {
    currentUser,
    users,
    groups,
    isLoading,
    refreshData,
    updatePreferences,
    markNotificationAsRead,
    sendVerificationSMS,
    verifyUserWithOTPCode
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
