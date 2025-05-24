
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  profilePicture?: string;
  address?: string;
  city?: string;
  country?: string;
  occupation?: string;
  bio?: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  emailVerified?: boolean;
  phoneVerified?: boolean;
  twoFactorAuthEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'inactive' | 'pending';
  settings?: {
    notificationsEnabled?: boolean;
    darkModeEnabled?: boolean;
    language?: string;
    currency?: string;
  };
  preferences?: {
    notifications?: boolean;
    darkMode?: boolean;
    language?: string;
    currency?: string;
  };
  groups?: string[];
  contributions?: string[];
  notifications?: {
    id: string;
    type: string;
    message: string;
    read: boolean;
    createdAt: string;
  }[];
  reservedAccount?: ReservedAccountData;
  verified?: boolean;
  walletBalance?: number;
  pin?: string;
}

export interface ReservedAccountData {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountReference: string;
  accounts?: {
    accountNumber: string;
    bankName: string;
    bankCode: string;
  }[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'vote';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'successful';
  createdAt: string;
  reference?: string;
  contributionId?: string;
  contributionName?: string;
  recipientName?: string;
  recipientAccount?: string;
  bankName?: string;
  senderName?: string;
  fee?: number;
  narration?: string;
  anonymous?: boolean;
  paymentMethod?: string;
  metaData?: {
    paymentReference?: string;
    paymentDetails?: {
      transactionId?: string;
      reference?: string;
    };
    transactionReference?: string;
    senderName?: string;
    senderBank?: string;
    bankName?: string;
    payerEmail?: string;
    [key: string]: any;
  };
}

export interface Contribution {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-time';
  isPrivate: boolean;
  allowAnonymous: boolean;
  requireApproval: boolean;
  adminId: string;
  creatorId: string;
  category: string;
  visibility: 'public' | 'private' | 'invite-only';
  status: 'active' | 'completed' | 'expired';
  deadline: string;
  votingThreshold: number;
  privacy: 'public' | 'private';
  memberRoles: 'equal' | 'weighted';
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  accountReference?: string;
  accountDetails?: any;
  members: string[];
  contributors?: {
    userId: string;
    name: string;
    amount: number;
    date: string;
    anonymous: boolean;
    paymentReference?: string;
    paymentDetails?: any;
  }[];
  withdrawalRequests?: WithdrawalRequest[];
}

export interface WithdrawalRequest {
  id: string;
  contributionId: string;
  userId: string;
  amount: number;
  purpose: string;
  reason: string;
  beneficiary: string;
  accountNumber: string;
  bankName: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  updatedAt?: string;
  deadline: string;
  votes: Record<string, 'approve' | 'reject'>;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId?: string;
  relatedId?: string;
}

export interface Stats {
  totalContributions: number;
  totalAmount: number;
  activeGroups: number;
  completedGroups: number;
}

export function hasContributed(userId: string, contributionId: string): boolean {
  try {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) return false;

    const contributions = JSON.parse(contributionsString);
    const contribution = contributions.find((c: Contribution) => c.id === contributionId);

    if (!contribution || !contribution.contributors) return false;

    return contribution.contributors.some(contributor => contributor.userId === userId);
  } catch (error) {
    console.error("Error in hasContributed:", error);
    return false;
  }
}
