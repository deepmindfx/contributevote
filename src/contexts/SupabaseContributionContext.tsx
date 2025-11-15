import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { ContributionService } from '@/services/supabase/contributionService';
import { TransactionService } from '@/services/supabase/transactionService';
import { SyncService } from '@/services/supabase/syncService';
import { Database } from '@/integrations/supabase/types';
import { useSupabaseUser } from './SupabaseUserContext';
import { supabase } from '@/integrations/supabase/client';

type ContributionGroup = Database['public']['Tables']['contribution_groups']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];
type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row'];

interface SupabaseContributionContextType {
  contributions: ContributionGroup[];
  transactions: Transaction[];
  withdrawalRequests: WithdrawalRequest[];
  stats: any;
  loading: boolean;
  refreshContributionData: () => Promise<void>;
  createNewContribution: (contribution: any) => Promise<ContributionGroup>;
  contribute: (contributionId: string, amount: number, anonymous?: boolean) => Promise<void>;
  contributeViaAccountNumber: (accountNumber: string, amount: number, contributorInfo: any, anonymous?: boolean) => Promise<void>;
  requestWithdrawal: (request: any) => Promise<void>;
  vote: (requestId: string, vote: 'approve' | 'reject') => Promise<void>;
  getShareLink: (contributionId: string) => string;
  shareToContacts: (contributionId: string, recipients: string[]) => Promise<void>;
  pingMembersForVote: (requestId: string) => Promise<void>;
  getReceipt: (transactionId: string) => any;
  isGroupCreator: (contributionId: string) => boolean;
}

const SupabaseContributionContext = createContext<SupabaseContributionContextType | undefined>(undefined);

export function SupabaseContributionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useSupabaseUser();
  const [contributions, setContributions] = useState<ContributionGroup[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const lastRefreshTime = useRef<number>(0);
  const isRefreshing = useRef<boolean>(false);

  const refreshContributionData = useCallback(async () => {
    if (!user) return;
    
    // Rate limiting: prevent calls within 2 seconds of each other
    const now = Date.now();
    if (now - lastRefreshTime.current < 2000 || isRefreshing.current) {
      console.log('Rate limiting: Skipping refresh call');
      return;
    }
    
    lastRefreshTime.current = now;
    isRefreshing.current = true;

    try {
      // Load user's contributions
      const userContributions = await ContributionService.getUserContributionGroups(user.id);
      setContributions(userContributions);

      // Load user's transactions
      const userTransactions = await TransactionService.getUserTransactions(user.id);
      setTransactions(userTransactions);

      // Load transaction stats
      const transactionStats = await TransactionService.getTransactionStats(user.id);
      setStats(transactionStats);

      // Load withdrawal requests for user's groups
      const { data: requests, error: requestsError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .in('contribution_id', userContributions.map(c => c.id))
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error loading withdrawal requests:', requestsError);
        setWithdrawalRequests([]);
      } else {
        setWithdrawalRequests(requests || []);
      }
    } catch (error) {
      console.error('Error refreshing contribution data:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
      
      // Set up realtime subscriptions for contribution updates
      const channel = supabase
        .channel('contribution-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contribution_groups'
          },
          () => {
            console.log('Contribution group changed, refreshing...');
            refreshContributionData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contributors'
          },
          () => {
            console.log('Contributors changed, refreshing...');
            refreshContributionData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthenticated, user, refreshContributionData]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading contributions')), 5000)
      );
      
      await Promise.race([refreshContributionData(), timeoutPromise]);
    } catch (error) {
      console.error('Error loading initial contribution data:', error);
      // Set empty arrays on error so app doesn't hang
      setContributions([]);
      setTransactions([]);
      setWithdrawalRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const createNewContribution = async (contributionData: any) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const newContribution = await ContributionService.createContributionGroup({
        name: contributionData.name,
        description: contributionData.description,
        target_amount: contributionData.targetAmount,
        category: contributionData.category,
        frequency: contributionData.frequency,
        contribution_amount: contributionData.contributionAmount,
        start_date: contributionData.startDate,
        end_date: contributionData.endDate,
        creator_id: user.id,
        privacy: contributionData.privacy || 'public',
        voting_threshold: contributionData.votingThreshold || 1,
        account_number: contributionData.accountNumber,
        account_name: contributionData.accountName,
        bank_name: contributionData.bankName,
        account_reference: contributionData.accountReference,
        account_details: contributionData.accountDetails || {}
      });

      // Sync the new contribution data
      await SyncService.syncContributionData(newContribution.id);
      await refreshContributionData();
      return newContribution;
    } catch (error) {
      console.error('Error creating contribution:', error);
      throw error;
    }
  };

  const contribute = async (contributionId: string, amount: number, anonymous: boolean = false) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Add contributor record
      await ContributionService.addContributor({
        group_id: contributionId,
        user_id: user.id,
        amount: amount,
        anonymous: anonymous
      });

      // Create transaction record
      await TransactionService.createTransaction({
        user_id: user.id,
        contribution_id: contributionId,
        type: 'deposit',
        amount: amount,
        description: `Contribution to group`,
        status: 'completed',
        anonymous: anonymous
      });

      // Sync contribution and user data
      await SyncService.syncContributionData(contributionId);
      await SyncService.syncUserData(user.id);
      await refreshContributionData();
    } catch (error) {
      console.error('Error contributing:', error);
      throw error;
    }
  };

  const contributeViaAccountNumber = async (
    accountNumber: string, 
    amount: number, 
    contributorInfo: any, 
    anonymous: boolean = false
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Find contribution by account number
      const allContributions = await ContributionService.getContributionGroups();
      const targetContribution = allContributions.find(c => c.account_number === accountNumber);
      
      if (!targetContribution) {
        throw new Error('Contribution group not found with this account number');
      }

      // Add contributor record
      await ContributionService.addContributor({
        group_id: targetContribution.id,
        user_id: user.id,
        amount: amount,
        anonymous: anonymous
      });

      // Create transaction record
      await TransactionService.createTransaction({
        user_id: user.id,
        contribution_id: targetContribution.id,
        type: 'deposit',
        amount: amount,
        description: `Contribution to ${targetContribution.name} via account number`,
        status: 'completed',
        anonymous: anonymous,
        metadata: {
          accountNumber: accountNumber,
          contributorInfo: contributorInfo
        }
      });

      await refreshContributionData();
    } catch (error) {
      console.error('Error contributing via account number:', error);
      throw error;
    }
  };

  const requestWithdrawal = async (request: any) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Calculate deadline (24 hours from now)
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);

      // Create withdrawal request
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          contribution_id: request.contributionId,
          requester_id: user.id,
          amount: request.amount,
          purpose: request.purpose,
          status: 'pending',
          deadline: deadline.toISOString(),
          votes: []
        })
        .select()
        .single();

      if (error) throw error;

      // Get all contributors for this group to notify them
      // @ts-ignore - Supabase type inference issue with deep queries
      const { data: contributors } = await supabase
        .from('contributors')
        .select('user_id')
        .eq('group_id', request.contributionId)
        .eq('has_voting_rights', true);

      // Get group details for notification
      const group = contributions.find(c => c.id === request.contributionId);

      // Create notifications for all contributors with voting rights
      if (contributors && contributors.length > 0) {
        const notifications = contributors
          .filter(c => c.user_id !== user.id) // Don't notify the requester
          .map(c => ({
            user_id: c.user_id,
            type: 'withdrawal_request',
            title: 'New Withdrawal Request',
            message: `${user.name} requested ₦${request.amount.toLocaleString()} withdrawal from ${group?.name}. Vote now!`,
            related_id: data.id,
            is_read: false,
            created_at: new Date().toISOString()
          }));

        if (notifications.length > 0) {
          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }

      await refreshContributionData();
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      throw error;
    }
  };

  const vote = async (requestId: string, voteValue: 'approve' | 'reject') => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Get the withdrawal request
      const { data: request, error: fetchError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;
      if (!request) throw new Error('Withdrawal request not found');

      // Check if user has already voted
      const votes = (request.votes as any) || [];
      const votesArray = Array.isArray(votes) ? votes : [];
      const hasVoted = votesArray.some((v: any) => v.user_id === user.id);

      if (hasVoted) {
        throw new Error('You have already voted on this request');
      }

      // Add the vote
      const newVote = {
        user_id: user.id,
        vote: voteValue,
        voted_at: new Date().toISOString()
      };

      const updatedVotes = [...votesArray, newVote];

      // Update the withdrawal request with the new vote
      const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({ votes: updatedVotes })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Check if voting threshold is met
      const approveVotes = updatedVotes.filter((v: any) => v.vote === 'approve').length;
      const rejectVotes = updatedVotes.filter((v: any) => v.vote === 'reject').length;

      // Get the contribution group to check voting threshold
      const { data: group } = await supabase
        .from('contribution_groups')
        .select('voting_threshold')
        .eq('id', request.contribution_id)
        .single();

      const threshold = group?.voting_threshold || 1;

      // Update status if threshold is met
      if (approveVotes >= threshold) {
        await supabase
          .from('withdrawal_requests')
          .update({ status: 'approved' })
          .eq('id', requestId);
      } else if (rejectVotes >= threshold) {
        await supabase
          .from('withdrawal_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);
      }

      await refreshContributionData();
    } catch (error) {
      console.error('Error voting:', error);
      throw error;
    }
  };

  const getShareLink = (contributionId: string): string => {
    return `${window.location.origin}/contribute/share/${contributionId}`;
  };

  const shareToContacts = async (contributionId: string, recipients: string[]) => {
    // TODO: Implement sharing service
    console.log('Share to contacts:', { contributionId, recipients });
  };

  const pingMembersForVote = async (requestId: string) => {
    // TODO: Implement notification service
    console.log('Ping members for vote:', requestId);
  };

  const getReceipt = (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    return transaction || null;
  };

  const isGroupCreator = (contributionId: string): boolean => {
    if (!user) return false;
    const contribution = contributions.find(c => c.id === contributionId);
    return contribution?.creator_id === user.id;
  };

  return (
    <SupabaseContributionContext.Provider value={{
      contributions,
      transactions,
      withdrawalRequests,
      stats,
      loading,
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
    }}>
      {children}
    </SupabaseContributionContext.Provider>
  );
}

export function useSupabaseContribution() {
  const context = useContext(SupabaseContributionContext);
  if (context === undefined) {
    throw new Error('useSupabaseContribution must be used within a SupabaseContributionProvider');
  }
  return context;
}