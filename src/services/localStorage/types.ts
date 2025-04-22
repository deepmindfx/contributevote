
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  status: 'active' | 'paused' | 'pending';
  createdAt: string;
  updatedAt: string;
  walletBalance: number;
  preferences: {
    darkMode: boolean;
    anonymousContributions?: boolean;
  };
  reservedAccount?: ReservedAccountData;
  otp?: string;
  isVerified?: boolean;
  name?: string; // Added for compatibility
}

export interface ReservedAccountData {
  accountNumber: string;
  bankName: string;
  accountName: string;
  accountReference: string;
  accounts?: {
    accountNumber: string;
    bankName: string;
  }[];
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  category: 'personal' | 'business' | 'family' | 'event' | 'education' | 'other';
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contributionAmount: number;
  startDate: string;
  endDate?: string;
  votingThreshold: number;
  privacy: 'public' | 'private';
  memberRoles: 'equal' | 'weighted';
  creatorId: string;
  visibility: 'public' | 'private' | 'invite-only';
  status: 'active' | 'completed' | 'expired';
  deadline: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  accountReference: string;
  accountDetails: any;
  contributors?: { [userId: string]: number };
  members?: string[];
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedBy: string;
  votes: {
    [userId: string]: 'approve' | 'reject';
  };
  createdAt: string;
  deadline?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'contribution' | 'withdrawal' | 'deposit' | 'transfer' | 'payment' | 'vote';
  status: 'pending' | 'completed' | 'failed' | 'successful';
  description: string;
  referenceId: string;
  reference?: string; // Added for backward compatibility
  contributionId?: string;
  paymentMethod: string;
  isAnonymous?: boolean;
  anonymous?: boolean; // Added for backward compatibility
  updatedAt: string;
  createdAt?: string; // Added for backward compatibility
  metaData?: TransactionMetaData;
  userDetails?: {
    name: string;
    email: string;
  };
  accountReference?: string;
}

export interface TransactionMetaData {
  contributionName?: string;
  bankName?: string;
  accountNumber?: string;
  contributorName?: string;
  withdrawalPurpose?: string;
  paymentReference?: string;
  senderName?: string;
  senderBank?: string;
  transactionReference?: string;
  accountReference?: string;
  customerName?: string; // Added for compatibility
}

// Added for backward compatibility
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Added for backward compatibility
export interface Stats {
  totalUsers: number;
  totalContributions: number;
  totalTransactions: number;
  totalWithdrawals: number;
  totalDeposits: number;
}
