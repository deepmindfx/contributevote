
import { useState } from 'react';
import { 
  getUserContributions,
  getWithdrawalRequests,
  getTransactions,
  getStatistics,
  updateWithdrawalRequestsStatus,
} from '@/services/localStorage';

export const useContributionData = (user: any, isAuthenticated: boolean) => {
  const [contributions, setContributions] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  const refreshContributionData = () => {
    if (isAuthenticated && user?.id) {
      // Only get contributions for this user if authenticated
      setContributions(getUserContributions(user.id));
      setWithdrawalRequests(getWithdrawalRequests());
      setTransactions(getTransactions());
      setStats(getStatistics());
    } else {
      // Reset data if not authenticated
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({});
    }
  };

  const checkExpiredRequests = () => {
    updateWithdrawalRequestsStatus();
    refreshContributionData();
  };

  const isGroupCreator = (contributionId: string): boolean => {
    const contribution = contributions.find((c: any) => c.id === contributionId);
    return !!(contribution && contribution.creatorId === user.id);
  };

  return {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    checkExpiredRequests,
    isGroupCreator,
  };
};
