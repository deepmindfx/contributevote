
import { useEffect } from 'react';
import { useContributionData } from './useContributionData';
import { useContributionActions } from './useContributionActions';
import { useWithdrawalActions } from './useWithdrawalActions';

export const useContributionState = (user: any, isAuthenticated: boolean, getUserByEmail: Function, getUserByPhone: Function) => {
  const {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    checkExpiredRequests,
    isGroupCreator,
  } = useContributionData(user, isAuthenticated);

  const {
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    getShareLink,
    shareToContacts,
    getReceipt,
  } = useContributionActions(user, contributions, refreshContributionData, getUserByEmail, getUserByPhone);

  const {
    requestWithdrawal,
    vote,
    pingMembersForVote,
  } = useWithdrawalActions(user, contributions, refreshContributionData);

  // Effect to check for expired withdrawal requests
  useEffect(() => {
    if (isAuthenticated) {
      // Run once at start
      checkExpiredRequests();
      
      // Then set interval to check every minute
      const interval = setInterval(checkExpiredRequests, 60000);
      
      // Clear interval on unmount
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  return {
    contributions,
    withdrawalRequests,
    transactions,
    stats,
    refreshContributionData,
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    requestWithdrawal,
    vote,
    getShareLink,
    shareToContacts,
    pingMembersForVote,
    getReceipt,
    isGroupCreator,
  };
};

export * from './useContributionData';
export * from './useContributionActions';
export * from './useWithdrawalActions';
