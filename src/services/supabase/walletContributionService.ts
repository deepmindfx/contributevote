import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    anonymous: boolean = false
  ): Promise<WalletContributionResult> {
    try {
      const { data, error } = await supabase.rpc('contribute_from_wallet', {
        p_user_id: userId,
        p_group_id: groupId,
        p_amount: amount,
        p_anonymous: anonymous
      });

      if (error) throw error;

      const result = data as WalletContributionResult;

      if (result.success) {
        toast.success('Contribution successful!', {
          description: 'You now have voting rights in this group.'
        });
      } else {
        toast.error(result.error || 'Contribution failed');
      }

      return result;
    } catch (error) {
      console.error('Error contributing from wallet:', error);
      toast.error('Failed to process contribution');
      return {
        success: false,
        error: error.message
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
    requesterId: string,
    reason: string,
    refundType: 'full' | 'partial' = 'full',
    partialPercentage?: number
  ): Promise<GroupRefundRequest | null> {
    try {
      // Get total eligible voters
      const { data: contributors } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', groupId)
        .eq('has_voting_rights', true);

      const totalEligibleVoters = contributors?.length || 0;

      // Set voting deadline (7 days from now)
      const votingDeadline = new Date();
      votingDeadline.setDate(votingDeadline.getDate() + 7);

      const { data, error } = await supabase
        .from('group_refund_requests')
        .insert({
          group_id: groupId,
          requester_id: requesterId,
          reason,
          refund_type: refundType,
          partial_percentage: partialPercentage,
          status: 'pending',
          voting_deadline: votingDeadline.toISOString(),
          total_eligible_voters: totalEligibleVoters
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Refund request created!', {
        description: 'Group members can now vote on this request.'
      });

      return data as GroupRefundRequest;
    } catch (error) {
      console.error('Error creating refund request:', error);
      toast.error('Failed to create refund request');
      return null;
    }
  },

  /**
   * Vote on a refund request
   */
  async voteOnRefund(
    refundRequestId: string,
    userId: string,
    vote: 'for' | 'against'
  ): Promise<boolean> {
    try {
      // Get current request
      const { data: request, error: fetchError } = await supabase
        .from('group_refund_requests')
        .select('*')
        .eq('id', refundRequestId)
        .single();

      if (fetchError) throw fetchError;

      // Check if user already voted
      const votes = (request as any).votes || [];
      const existingVote = votes.find((v: any) => v.user_id === userId);

      if (existingVote) {
        toast.error('You have already voted on this request');
        return false;
      }

      // Add vote
      const newVotes = [...votes, { user_id: userId, vote, voted_at: new Date().toISOString() }];
      const votesFor = newVotes.filter((v: any) => v.vote === 'for').length;
      const votesAgainst = newVotes.filter((v: any) => v.vote === 'against').length;

      // Check if majority reached (>50%)
      const totalEligibleVoters = (request as any).total_eligible_voters;
      const majorityNeeded = Math.floor(totalEligibleVoters / 2) + 1;
      const newStatus = votesFor >= majorityNeeded ? 'approved' : 'pending';

      const { error: updateError } = await supabase
        .from('group_refund_requests')
        .update({
          votes: newVotes,
          total_votes_for: votesFor,
          total_votes_against: votesAgainst,
          status: newStatus
        })
        .eq('id', refundRequestId);

      if (updateError) throw updateError;

      if (newStatus === 'approved') {
        toast.success('Refund request approved!', {
          description: 'Refunds will be processed shortly.'
        });
        // Trigger refund processing
        await this.processRefund(refundRequestId);
      } else {
        toast.success('Vote recorded');
      }

      return true;
    } catch (error) {
      console.error('Error voting on refund:', error);
      toast.error('Failed to record vote');
      return false;
    }
  },

  /**
   * Process an approved refund
   */
  async processRefund(refundRequestId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('process_group_refund', {
        p_refund_request_id: refundRequestId
      });

      if (error) throw error;

      const result = data as any;

      if (result.success) {
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
      return (data as GroupRefundRequest[]) || [];
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
