import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { paymentAttempt } from '@/lib/paymentAttempt';

export interface WalletContributionResult {
  success: boolean;
  message?: string;
  error?: string;
  transaction_id?: string;
  contributor_id?: string;
  new_balance?: number;
  voting_rights_granted?: boolean;
}

export interface RecurringContribution {
  id: string;
  user_id: string;
  group_id: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date?: string;
  next_contribution_date: string;
  is_active: boolean;
  total_contributions: number;
  total_amount: number;
}

export interface ScheduledContribution {
  id: string;
  user_id: string;
  group_id: string;
  amount: number;
  scheduled_date: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

export interface GroupRefundRequest {
  id: string;
  group_id: string;
  requester_id: string;
  reason: string;
  refund_type: 'full' | 'partial';
  partial_percentage?: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  voting_deadline: string;
  votes: any[];
  total_votes_for: number;
  total_votes_against: number;
  total_eligible_voters: number;
  execution_details?: {
    total_refunded: number;
    refunds_processed: number;
    refunds_failed: number;
  };
}

export const WalletContributionService = {
  /**
   * Contribute to a group from wallet balance
   * Grants instant voting rights
   */
  async contributeFromWallet(
    userId: string,
    groupId: string,
    amount: number,
    anonymous: boolean = false,
    pin?: string
  ): Promise<WalletContributionResult> {
    try {
      const attempt = await paymentAttempt("contribution", userId, [groupId, amount, anonymous]);
      const { data, error } = await supabase.rpc('submit_wallet_contribution', {
        p_attempt_id: attempt.id,
        p_group_id: groupId,
        p_amount: amount,
        p_anonymous: anonymous,
        p_pin: pin || null,
      });

      if (error) {
        console.error('Contribution error:', error);
        throw error;
      }

      const result = data as unknown as WalletContributionResult | null;
      if (!result) throw new Error('The contribution could not be confirmed.');
      attempt.finish();

      if (result.success) {
        const votingNote =
          result.voting_rights_granted !== false ? ' Voting rights active!' : '';
        toast.success('Contribution pooled successfully!', {
          description: `New wallet balance: ₦${Number(result.new_balance ?? 0).toLocaleString()}.${votingNote}`
        });
      } else {
        toast.error(result.error || 'Contribution failed');
      }

      return result;
    } catch (error) {
      console.error('Error contributing from wallet:', error);
      const message = error instanceof Error ? error.message : 'Failed to process contribution';
      toast.error(message);
      return {
        success: false,
        error: message
      };
    }
  },

  /**
   * Create a recurring contribution schedule
   */
  async createRecurringContribution(
    userId: string,
    groupId: string,
    amount: number,
    frequency: 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<RecurringContribution | null> {
    try {
      const nextDate = this.calculateNextContributionDate(frequency, startDate);

      const { data, error } = await supabase
        .from('recurring_contributions')
        .insert({
          user_id: userId,
          group_id: groupId,
          amount,
          frequency,
          start_date: startDate?.toISOString() || new Date().toISOString(),
          end_date: endDate?.toISOString(),
          next_contribution_date: nextDate.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Recurring contribution created!', {
        description: `You'll contribute ₦${amount} ${frequency}`
      });

      return data as RecurringContribution;
    } catch (error) {
      console.error('Error creating recurring contribution:', error);
      toast.error('Failed to create recurring contribution');
      return null;
    }
  },

  /**
   * Get user's recurring contributions
   */
  async getUserRecurringContributions(userId: string): Promise<RecurringContribution[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_contributions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as RecurringContribution[]) || [];
    } catch (error) {
      console.error('Error fetching recurring contributions:', error);
      return [];
    }
  },

  /**
   * Cancel a recurring contribution
   */
  async cancelRecurringContribution(recurringId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recurring_contributions')
        .update({ is_active: false })
        .eq('id', recurringId);

      if (error) throw error;

      toast.success('Recurring contribution cancelled');
      return true;
    } catch (error) {
      console.error('Error cancelling recurring contribution:', error);
      toast.error('Failed to cancel recurring contribution');
      return false;
    }
  },

  /**
   * Schedule a one-time contribution
   */
  async scheduleContribution(
    userId: string,
    groupId: string,
    amount: number,
    scheduledDate: Date
  ): Promise<ScheduledContribution | null> {
    try {
      const { data, error } = await supabase
        .from('scheduled_contributions')
        .insert({
          user_id: userId,
          group_id: groupId,
          amount,
          scheduled_date: scheduledDate.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Contribution scheduled!', {
        description: `Will be processed on ${scheduledDate.toLocaleDateString()}`
      });

      return data as ScheduledContribution;
    } catch (error) {
      console.error('Error scheduling contribution:', error);
      toast.error('Failed to schedule contribution');
      return null;
    }
  },

  /**
   * Get user's scheduled contributions
   */
  async getUserScheduledContributions(userId: string): Promise<ScheduledContribution[]> {
    try {
      const { data, error } = await supabase
        .from('scheduled_contributions')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return (data as ScheduledContribution[]) || [];
    } catch (error) {
      console.error('Error fetching scheduled contributions:', error);
      return [];
    }
  },

  /**
   * Cancel a scheduled contribution
   */
  async cancelScheduledContribution(scheduledId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('scheduled_contributions')
        .update({ status: 'cancelled' })
        .eq('id', scheduledId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success('Scheduled contribution cancelled');
      return true;
    } catch (error) {
      console.error('Error cancelling scheduled contribution:', error);
      toast.error('Failed to cancel scheduled contribution');
      return false;
    }
  },

  /**
   * Create a group refund request
   */
  async createRefundRequest(
    groupId: string,
    reason: string,
    refundType: 'full' | 'partial',
    partialPercentage: number | undefined,
    pin: string,
  ): Promise<GroupRefundRequest | null> {
    try {
      const { data, error } = await supabase.rpc('create_group_refund_request', {
        p_group_id: groupId,
        p_reason: reason,
        p_refund_type: refundType,
        p_percent: partialPercentage ?? null,
        p_pin: pin,
      });
      const result = data as { request?: GroupRefundRequest; error?: string } | null;
      if (error || !result?.request) throw new Error(result?.error || error?.message || 'Could not open the refund vote.');
      toast.success('Refund vote opened.');
      return result.request;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the refund vote.');
      return null;
    }
  },

  /**
   * Vote on a refund request atomically via server-side RPC
   * Enforces verified voting rights, 70% participation quorum, and group's voting_threshold%
   */
  async voteOnRefund(
    refundRequestId: string,
    _userId: string,
    vote: 'for' | 'against'
  ): Promise<boolean> {
    try {
      const { data, error } = await (supabase as any).rpc('cast_refund_vote', {
        p_refund_request_id: refundRequestId,
        p_vote: vote,
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.error || 'Could not record your vote');
        return false;
      }

      const participation = Number(data.participation_rate || 0).toFixed(0);
      const approval = Number(data.approval_rate || 0).toFixed(0);
      const threshold = Number(data.voting_threshold || 60);

      if (data.status === 'executed') {
        toast.success('Refund approved & executed', {
          description: `${participation}% participated · ${approval}% approved (needed ${threshold}%). Refunds credited to wallets.`,
        });
      } else if (data.status === 'approved') {
        toast.info('Refund approved. Settlement is pending.');
      } else if (data.status === 'rejected') {
        toast.error('Refund proposal rejected', {
          description: `Did not reach the ${threshold}% approval threshold.`,
        });
      } else {
        toast.success('Vote recorded', {
          description: `${participation}% voted · ${approval}% said yes (needs 70% of members to vote & ${threshold}% yes)`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error voting on refund:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to record vote', {
        description: errorMessage,
      });
      return false;
    }
  },

  /**
   * Process an approved refund
   */
  async processRefund(refundRequestId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('retry_group_refund', {
        p_refund_request_id: refundRequestId
      });

      if (error) throw error;

      const result = data as any;

      if (result.success) {
        if (result.already_executed) return true;
        toast.success('Refund processed successfully!', {
          description: `₦${result.total_refunded} refunded to ${result.refunds_processed} contributors`
        });
        return true;
      } else {
        toast.error(result.error || 'Refund processing failed');
        return false;
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Failed to process refund');
      return false;
    }
  },

  /**
   * Get refund requests for a group
   */
  async getGroupRefundRequests(groupId: string): Promise<GroupRefundRequest[]> {
    try {
      const { data, error } = await supabase
        .from('group_refund_requests')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as GroupRefundRequest[]) || [];
    } catch (error) {
      console.error('Error fetching refund requests:', error);
      return [];
    }
  },

  /**
   * Helper: Calculate next contribution date
   */
  calculateNextContributionDate(frequency: string, startDate?: Date): Date {
    const date = startDate || new Date();
    const next = new Date(date);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }
};
