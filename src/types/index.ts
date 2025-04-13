
// User related types
export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'user' | 'admin';
  walletBalance: number;
  verified: boolean;
  status: 'active' | 'paused';
  createdAt: string;
  pin?: string;
  preferences?: {
    darkMode?: boolean;
    notifications?: boolean;
  };
  notifications?: Notification[];
  reservedAccount?: any;
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
  currentAmount: number;
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

