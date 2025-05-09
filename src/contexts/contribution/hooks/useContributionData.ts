
import { useState, useEffect, useRef } from 'react';
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
  const currentUserId = useRef<string | null>(null);

  // Effect to load data once upon authentication
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Only proceed if user ID has changed or this is the first load
      if (currentUserId.current !== user.id) {
        currentUserId.current = user.id;
        // Initial load
        refreshContributionData();
      }
    } else {
      // Reset data if not authenticated
      currentUserId.current = null;
      setContributions([]);
      setWithdrawalRequests([]);
      setTransactions([]);
      setStats({});
    }
  }, [isAuthenticated, user?.id]);

  // Separate effect for polling that doesn't depend on user ID changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Only set up polling if authenticated
      const intervalId = setInterval(() => {
        if (user?.id === currentUserId.current) { // Only refresh if user hasn't changed
          refreshContributionData();
        }
      }, 30000); // Poll every 30 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, user?.id]);

  const refreshContributionData = () => {
    if (isAuthenticated && user?.id && user?.id === currentUserId.current) {
      try {
        // Record refresh time
        setLastRefreshTime(Date.now());
        
        // Only get contributions for this user if authenticated
        setContributions(getUserContributions(user.id));
        setWithdrawalRequests(getWithdrawalRequests());
        setTransactions(getTransactions());
        setStats(getStatistics());
      } catch (error) {
        console.error("Error refreshing contribution data:", error);
      }
    }
  };

  const checkExpiredRequests = () => {
    try {
      if (isAuthenticated && user?.id && user?.id === currentUserId.current) {
        updateWithdrawalRequestsStatus();
        refreshContributionData();
      }
    } catch (error) {
      console.error("Error checking expired requests:", error);
    }
  };

  const isGroupCreator = (contributionId: string): boolean => {
    try {
      if (!isAuthenticated || !user?.id) return false;
      
      const contribution = contributions.find((c: any) => c.id === contributionId);
      return !!(contribution && contribution.creatorId === user?.id);
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
