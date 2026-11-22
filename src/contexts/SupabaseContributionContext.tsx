import { createContext, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import { ContributionService } from '@/services/supabase/contributionService';
import { TransactionService } from '@/services/supabase/transactionService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { voteOnWithdrawal as voteOnWithdrawalService } from '@/services/supabase/withdrawalService';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { Database } from '@/integrations/supabase/types';
import { useSupabaseUser } from './SupabaseUserContext';
import { supabase } from '@/integrations/supabase/client';

type ContributionGroup = Database['public']['Tables']['contribution_groups']['Row'] & {
  contributors?: Pick<Database['public']['Tables']['contributors']['Row'], 'user_id' | 'has_voting_rights'>[];
};
type Transaction = Database['public']['Tables']['transactions']['Row'];
type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row'];

interface SupabaseContributionContextType {
  contributions: ContributionGroup[];
  transactions: Transaction[];
  withdrawalRequests: WithdrawalRequest[];
  loading: boolean;
  transactionsLoading: boolean;
  refreshContributionData: (force?: boolean) => Promise<void>;
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

const emptyGroups: ContributionGroup[] = [];
const emptyTransactions: Transaction[] = [];
const emptyWithdrawals: WithdrawalRequest[] = [];
const recentLimit = 15;

export function SupabaseContributionProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseUser();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const previousUser = useRef(userId);
  const route = pathname.replace(/\/$/, "");
  const history = route === "/wallet-history" || route === "/profile";
  const recent = route === "/dashboard";
  const workspace = ["workspace", userId] as const;
  const groups = useQuery({
    queryKey: [...workspace, "groups"],
    queryFn: ({ signal }) => ContributionService.getUserContributionGroups(userId!, signal),
    enabled: Boolean(userId),
    staleTime: 20_000,
    retry: false,
  });
  const contributions = groups.data ?? emptyGroups;
  const ledger = useQuery({
    queryKey: [...workspace, "transactions", history ? "history" : "recent"],
    queryFn: ({ signal }) => TransactionService.getUserTransactions(userId!, { signal, limit: history ? undefined : recentLimit }),
    enabled: Boolean(userId && (recent || history)),
    staleTime: 20_000,
    retry: false,
  });
  const transactions = ledger.data ?? emptyTransactions;
  const groupIds = contributions.map((group) => group.id).sort();
  const withdrawals = useQuery({
    queryKey: [...workspace, "withdrawals", groupIds],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("withdrawal_requests").select("*")
        .in("contribution_id", groupIds).order("created_at", { ascending: false }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId && groupIds.length > 0),
    staleTime: 20_000,
    retry: false,
  });
  const withdrawalRequests = withdrawals.data ?? emptyWithdrawals;
  const loading = groups.isLoading;
  const transactionsLoading = ledger.isLoading;

  useEffect(() => {
    if (previousUser.current && previousUser.current !== userId) {
      queryClient.removeQueries({ queryKey: ["workspace", previousUser.current] });
      queryClient.removeQueries({ queryKey: ["transfer-allowance", previousUser.current] });
      queryClient.removeQueries({ queryKey: ["transfer-beneficiaries", previousUser.current] });
    }
    previousUser.current = userId;
  }, [userId, queryClient]);

  const refreshContributionData = useCallback(async (_force?: boolean) => {
    if (userId) await queryClient.invalidateQueries({ queryKey: ["workspace", userId] });
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId) return;
    const key = ["workspace", userId] as const;
    const groupKey = [...key, "groups"] as const;
    const known = (id: unknown) => queryClient.getQueryData<ContributionGroup[]>(groupKey)?.some((group) => group.id === id);
    let groupTimer: number | undefined;
    let withdrawalTimer: number | undefined;
    const reloadGroups = () => {
      window.clearTimeout(groupTimer);
      groupTimer = window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: groupKey }), 180);
    };
    const reloadWithdrawals = () => {
      window.clearTimeout(withdrawalTimer);
      withdrawalTimer = window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: [...key, "withdrawals"] }), 120);
    };
    const channel = supabase.channel(`workspace-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contribution_groups" }, (event) => {
        const group = (event.eventType === "DELETE" ? event.old : event.new) as Partial<ContributionGroup>;
        if (group.creator_id === userId || known(group.id)) reloadGroups();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contributors" }, (event) => {
        const member = (event.eventType === "DELETE" ? event.old : event.new) as { user_id?: string; group_id?: string };
        if (!member.group_id || member.user_id === userId || known(member.group_id)) reloadGroups();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, (event) => {
        const request = (event.eventType === "DELETE" ? event.old : event.new) as Partial<WithdrawalRequest>;
        if (!request.contribution_id || known(request.contribution_id)) reloadWithdrawals();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, (event) => {
        for (const view of ["recent", "history"]) {
          queryClient.setQueryData<Transaction[]>([...key, "transactions", view], (previous) => {
            if (!previous) return previous;
            if (event.eventType === "DELETE") {
              return previous.filter((transaction) => transaction.id !== event.old.id);
            }
            const transaction = event.new as Transaction;
            if (transaction.user_id !== userId) return previous;
            const rows = [transaction, ...previous.filter((item) => item.id !== transaction.id)]
              .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
            return view === "recent" ? rows.slice(0, recentLimit) : rows;
          });
        }
      })
      .subscribe();
    return () => {
      window.clearTimeout(groupTimer);
      window.clearTimeout(withdrawalTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

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

      await refreshContributionData();
      return newContribution;
    } catch (error) {
      console.error('Error creating contribution:', error);
      throw error;
    }
  };

  const contribute = async (contributionId: string, amount: number, anonymous: boolean = false) => {
    if (!user) throw new Error('User not authenticated');

    const result = await WalletContributionService.contributeFromWallet(
      user.id,
      contributionId,
      amount,
      anonymous
    );

    if (!result.success) {
      throw new Error(result.error || 'Contribution failed');
    }

    await refreshContributionData();
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
      // Calculate deadline (7 days from now — consistent with governance rules)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);

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

      await refreshContributionData(true);
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      throw error;
    }
  };

  const vote = async (requestId: string, voteValue: 'approve' | 'reject') => {
    if (!user) throw new Error('User not authenticated');

    try {
      const result = await voteOnWithdrawalService(requestId, voteValue === 'approve');

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit vote');
      }

      await refreshContributionData(true);
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
      loading,
      transactionsLoading,
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
