
import { ReservedAccountData, CardTokenData, InvoiceData } from "@/services/wallet/types";
import { isValid } from "date-fns";

/**
 * Type definitions for local storage data
 */

/**
 * Interface for user data stored in local storage
 */
export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  phoneNumber?: string; // For compatibility with existing components
  username?: string;
  profileImage?: string;
  walletBalance: number;
  reservedAccount?: ReservedAccountData;
  cardTokens?: CardTokenData[];
  invoices?: InvoiceData[];
  role: "user" | "admin";
  status: "active" | "paused";
  pin?: string;
  verified?: boolean;
  createdAt?: string;
  notifications?: Array<{
    id: string;
    message: string;
    read: boolean;
    createdAt: string;
    relatedId?: string;
    type?: string;
  }>;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled: boolean;
  };
}

/**
 * Interface for contribution data stored in local storage
 */
export interface Contribution {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  creatorId: string;
  category: string;
  status: "active" | "completed" | "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  videoUrl?: string;
  location?: string;
  isPublic: boolean;
  isAnonymousAllowed: boolean;
  targetAmount?: number;
  frequency?: "daily" | "weekly" | "monthly" | "one-time";
  contributionAmount?: number;
  votingThreshold?: number;
  accountNumber?: string;
  members?: string[];
  contributors?: Array<{
    userId: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }>;
}

/**
 * Interface for transaction data stored in local storage
 */
export interface Transaction {
  id: string;
  userId: string;
  contributionId: string;
  amount: number;
  type: "deposit" | "withdrawal" | "vote";
  status: "pending" | "completed" | "rejected";
  createdAt: string;
  description: string;
  anonymous?: boolean;
  metaData?: any;
}

/**
 * Interface for withdrawal request
 */
export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  creatorId: string;
  amount: number;
  reason: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
    votedAt: string;
  }[];
  createdAt: string;
  deadline: string;
}

/**
 * Interface for app statistics data stored in local storage
 */
export interface AppStats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalAmount: number;
  activeRequests: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}

export interface Stats extends AppStats {}

/**
 * Local storage keys
 */
export const localStorageKeys = {
  users: "collectipay_users",
  contributions: "collectipay_contributions",
  transactions: "collectipay_transactions",
  appStats: "collectipay_app_stats",
  withdrawalRequests: "collectipay_withdrawal_requests",
  currentUser: "collectipay_currentUser"
};

/**
 * Helper to validate dates
 */
export const validateDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return isValid(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};
