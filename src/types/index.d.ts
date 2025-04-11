
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  walletBalance: number;
  notifications?: Notification[];
  preferences?: {
    darkMode?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    language?: string;
  };
  createdAt: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: 'system' | 'transaction' | 'contribution' | 'withdrawal';
}

export interface Transaction {
  id: string;
  userId: string;
  recipientId?: string;
  amount: number;
  type: 'credit' | 'debit' | 'transfer';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: string;
  createdAt: string;
  anonymous?: boolean;
  [key: string]: any;
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  creatorId: string;
  members: string[];
  contributors: {
    userId: string;
    amount: number;
    date: string;
    anonymous: boolean;
    name?: string;
  }[];
  createdAt: string;
  accountNumber: string;
  status: 'active' | 'completed' | 'cancelled';
  deadline: string;
  visibility: 'public' | 'private';
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  contributionAmount: number;
  startDate: string;
  endDate: string;
  votingThreshold: number;
  privacy: 'public' | 'private';
  memberRoles: 'equal' | 'weighted';
  [key: string]: any;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  reason: string;
  purpose: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  deadline: string;
  votes: {
    userId: string;
    vote: 'approve' | 'reject';
    date: string;
  }[];
  [key: string]: any;
}

export interface Stats {
  totalUsers: number;
  activeGroups: number;
  totalTransactions: number;
  totalAmount?: number;
  activeRequests?: number;
  totalWithdrawals?: number;
  [key: string]: any;
}

export interface DateRange {
  from: Date;
  to?: Date;
}
