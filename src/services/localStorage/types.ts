
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  walletBalance: number;
  preferences?: {
    darkMode: boolean;
    anonymousContributions: boolean;
    notificationsEnabled?: boolean;
  };
  role: 'user' | 'admin' | 'paused';
  accountNumber?: string;
  accountName?: string;
  verified: boolean;
  reservedAccount?: any;
  invoices?: any[];
  cardTokens?: any[];
  notifications?: any[];
  // Add missing fields that are used in the codebase
  phone?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImage?: string;
  status?: string;
  createdAt?: string;
  pin?: string;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  category: "personal" | "family" | "community" | "business" | "event" | "education" | "other";
  frequency: "daily" | "weekly" | "monthly" | "one-time";
  contributionAmount: number;
  startDate: string;
  endDate?: string;
  deadline?: string;
  creatorId: string;
  members: string[];
  contributors: any[];
  createdAt: string;
  status?: "active" | "completed" | "expired";
  visibility?: "public" | "private" | "invite-only";
  privacy?: string;
  memberRoles?: string;
  votingThreshold?: number;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  accountReference?: string;
  accountDetails?: any;
}

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "transfer" | "payment" | "vote";
  amount: number;
  narration?: string;
  status?: "pending" | "successful" | "failed" | "completed";
  reference?: string;
  userId: string;
  toUserId?: string;
  contributionId?: string;
  createdAt: string;
  paymentMethod?: string;
  metadata?: any;
  metaData?: any; // Some places use metaData others use metadata
  description?: string;
  anonymous?: boolean;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
  }[];
  createdAt: string;
  deadline: string;
  beneficiary: string;
  accountNumber: string;
  bankName: string;
  purpose: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalWithdrawals: number;
  totalAmountContributed: number;
}
