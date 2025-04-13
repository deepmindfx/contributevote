
import { User, Transaction, Contribution } from '@/localStorage';

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

// Re-export the types from localStorage.ts for convenience
export type { User, Transaction, Contribution };
