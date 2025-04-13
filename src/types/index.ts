
// User related types
export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string; // Added for compatibility
  username?: string; // Added for compatibility
  profileImage?: string; // Added for compatibility
  role: 'user' | 'admin';
  walletBalance: number;
  verified: boolean;
  status: 'active' | 'paused';
  createdAt: string;
  pin?: string;
  preferences?: {
    darkMode?: boolean;
    notifications?: boolean;
    notificationsEnabled?: boolean; // Added for compatibility
    anonymousContributions?: boolean; // Added for compatibility
  };
  notifications?: Notification[];
  reservedAccount?: ReservedAccountData;
  cardTokens?: any[];
  invoices?: any[];
}

// Contribution related types
export interface Contribution {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  goalAmount: number;
  targetAmount: number; // Added for compatibility with ContributePage
  currentAmount: number;
  contributionAmount?: number; // Added for compatibility with ContributePage
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  createdAt: string;
  members: string[];
  contributors: {
    userId: string;
    name: string;
    amount: number;
    date: string;
    anonymous: boolean;
  }[];
  public: boolean;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  accountReference?: string;
  accountDetails?: any;
  votingThreshold?: number;
  category?: string; // Added for compatibility
}

// Transaction related types
export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'vote';
  amount: number;
  contributionId?: string;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  metaData?: Record<string, any>;
}

// Withdrawal request types
export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  requesterId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  deadline: string;
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
    date: string;
  }[];
  // Additional properties used in the Votes component
  requestId?: string;
  contributionName?: string;
  hasContributed?: boolean;
  hasVoted?: boolean;
  userVote?: 'approve' | 'reject' | null;
}

// Notification type
export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

// Statistics types
export interface Stats {
  totalContributions: number;
  activeContributions: number;
  totalContributed: number;
  totalMembers: number;
}

// Export types for ReservedAccount components
export interface ReservedAccountData {
  accountReference: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  currencyCode: string;
  status: string;
  createdOn: string;
  customerEmail: string;
  customerName: string;
  incomeSplitConfig: any;
  reservedAccountType: string;
  contractCode?: string;
  accounts?: Array<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
  }>;
}
