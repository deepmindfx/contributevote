
import { User, Contribution, WithdrawalRequest, Transaction, Stats } from '@/services/localStorage/types';

export interface AppContextType {
  user: User;
  users: User[];
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: Stats;
  refreshData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous?: boolean) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  updateProfile: (userData: Partial<User>) => void;
  updateUserAsAdmin: (userId: string, userData: Partial<User>) => void;
  depositToUserAsAdmin: (userId: string, amount: number) => void;
  pauseUserAsAdmin: (userId: string) => void;
  activateUserAsAdmin: (userId: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  logout: () => void;
  getUserByEmail: (email: string) => User | null;
  getUserByPhone: (phone: string) => User | null;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  verifyUser: (userId: string) => void;
  isGroupCreator: (contributionId: string) => boolean;
}
