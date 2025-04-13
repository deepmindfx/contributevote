
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  getUserContributions,
  getWithdrawalRequests,
  getTransactions,
  getStatistics,
  createContribution,
  contributeToGroup,
  contributeByAccountNumber,
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  generateShareLink,
  pingGroupMembersForVote,
  generateContributionReceipt,
  updateWithdrawalRequestsStatus,
} from '@/services/localStorage';
import { shareContributionToContacts } from './utils';

export const useContributionState = (user: any, isAuthenticated: boolean, getUserByEmail: Function, getUserByPhone: Function) => {
  const [contributions, setContributions] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  // Effect to check for expired withdrawal requests
  useEffect(() => {
    if (isAuthenticated) {
      const checkExpiredRequests = () => {
        updateWithdrawalRequestsStatus();
        refreshContributionData();
      };
      
      // Run once at start
      checkExpiredRequests();
      
      // Then set interval to check every minute
      const interval = setInterval(checkExpiredRequests, 60000);
      
      // Clear interval on unmount
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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

  const createNewContribution = (contribution: any) => {
    try {
      createContribution(contribution);
      refreshContributionData();
      toast.success('Contribution group created successfully!');
    } catch (error) {
      toast.error('Failed to create contribution group');
      console.error(error);
    }
  };

  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    try {
      if (user.walletBalance < amount) {
        toast.error('Insufficient funds in your wallet');
        return;
      }
      
      contributeToGroup(contributionId, amount, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const contributeViaAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
    try {
      contributeByAccountNumber(accountNumber, amount, contributorInfo, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to make contribution');
      }
      console.error(error);
    }
  };

  const requestWithdrawal = (request: any) => {
    try {
      // Check if user has set up a PIN
      if (!user.pin) {
        toast.error('Please set up a transaction PIN in settings before requesting withdrawals');
        return;
      }
      
      const contribution = contributions.find((c: any) => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      // Check if user is the creator of the group
      if (contribution.creatorId !== user.id) {
        toast.error('Only the group creator can request withdrawals');
        return;
      }
      
      if (contribution.currentAmount < request.amount) {
        toast.error('Requested amount exceeds available funds');
        return;
      }
      
      createWithdrawalRequest(request);
      refreshContributionData();
      toast.success('Withdrawal request submitted for voting');
    } catch (error) {
      toast.error('Failed to create withdrawal request');
      console.error(error);
    }
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      voteOnWithdrawalRequest(requestId, vote);
      refreshContributionData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to submit vote');
      }
      console.error(error);
    }
  };

  const getShareLink = (contributionId: string) => {
    return generateShareLink(contributionId);
  };
  
  const shareToContacts = (contributionId: string, recipients: string[]) => {
    try {
      const contribution = contributions.find((c: any) => c.id === contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      shareContributionToContacts(contributionId, recipients, contribution, user.id, user.name, getUserByEmail, getUserByPhone);
      
      toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
      refreshContributionData();
    } catch (error) {
      toast.error('Failed to share contribution');
      console.error(error);
    }
  };
  
  const pingMembersForVote = (requestId: string) => {
    try {
      pingGroupMembersForVote(requestId);
      toast.success('Reminder sent to all members who have not voted yet');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to send reminders');
      }
      console.error(error);
    }
  };
  
  const getReceipt = (transactionId: string) => {
    try {
      const receipt = generateContributionReceipt(transactionId);
      if (!receipt) {
        toast.error('Unable to generate receipt for this transaction');
        return null;
      }
      return receipt;
    } catch (error) {
      toast.error('Failed to generate receipt');
      console.error(error);
      return null;
    }
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
