
import {
  User,
  Contribution,
  WithdrawalRequest,
  Transaction,
  Stats
} from '@/services/localStorage';

export interface ContributionContextType {
  contributions: Contribution[];
  withdrawalRequests: WithdrawalRequest[];
  transactions: Transaction[];
  stats: Stats;
  refreshContributionData: () => void;
  createNewContribution: (contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors'>) => void;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => void;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous?: boolean) => void;
  requestWithdrawal: (request: Omit<WithdrawalRequest, 'id' | 'createdAt' | 'status' | 'votes' | 'deadline'>) => void;
  vote: (requestId: string, vote: 'approve' | 'reject') => void;
  getShareLink: (contributionId: string) => string;
  shareToContacts: (contributionId: string, recipients: string[]) => void;
  pingMembersForVote: (requestId: string) => void;
  getReceipt: (transactionId: string) => any;
  isGroupCreator: (contributionId: string) => boolean;
}
