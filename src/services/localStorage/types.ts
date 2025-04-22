export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  profilePicture?: string;
  address?: string;
  city?: string;
  country?: string;
  walletBalance?: number;
  reservedAccount?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
    accountReference: string;
    accounts: Array<{
      accountNumber: string;
      bankName: string;
    }>;
  };
  isAdmin?: boolean;
  isVerified?: boolean;
  isPaused?: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: string;
  updatedAt: string;
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
  transactions?: string[];
  contributors?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: {
    [userId: string]: 'approve' | 'reject';
  };
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'contribution' | 'payout';
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  referenceId?: string;
  accountReference?: string;
  createdAt: string;
  updatedAt: string;
  contributionId?: string;
  withdrawalRequestId?: string;
  paymentMethod?: string;
  isAnonymous?: boolean;
  userDetails?: {
    name: string;
    email?: string;
    phone?: string;
  };
}
