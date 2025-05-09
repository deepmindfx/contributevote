
import { useState, useEffect } from 'react';
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
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Effect to periodically check for new transactions from Monnify
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Set up polling for new transactions (every 30 seconds)
      const intervalId = setInterval(() => {
        refreshContributionData();
      }, 30000);
      
      // Initial load
      refreshContributionData();
      
      return () => clearInterval(intervalId);
    } else {
      // Reset data if not authenticated
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({});
    }
  }, [isAuthenticated, user?.id]);

  const refreshContributionData = () => {
    if (!isAuthenticated || !user?.id) {
      // Don't attempt to refresh if not authenticated or no user ID
      return;
    }
    
    try {
      // Record refresh time
      setLastRefreshTime(Date.now());
      
      // Only get contributions for this user if authenticated
      const userContributions = getUserContributions(user.id);
      setContributions(userContributions);
      
      const allWithdrawalRequests = getWithdrawalRequests();
      setWithdrawalRequests(allWithdrawalRequests);
      
      const allTransactions = getTransactions();
      setTransactions(allTransactions);
      
      const statistics = getStatistics();
      setStats(statistics);
    } catch (error) {
      console.error("Error refreshing contribution data:", error);
    }
  };

  const checkExpiredRequests = () => {
    if (!isAuthenticated || !user?.id) return;
    
    try {
      updateWithdrawalRequestsStatus();
      refreshContributionData();
    } catch (error) {
      console.error("Error checking expired requests:", error);
    }
  };

  const isGroupCreator = (contributionId: string): boolean => {
    if (!isAuthenticated || !user?.id) return false;
    
    try {
      const contribution = contributions.find((c: any) => c.id === contributionId);
      return !!(contribution && contribution.creatorId === user.id);
    } catch (error) {
      console.error("Error checking if user is group creator:", error);
      return false;
    }
  };

  return {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    checkExpiredRequests,
    isGroupCreator,
    lastRefreshTime,
  };
};
