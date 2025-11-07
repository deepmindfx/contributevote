import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContributorService } from './contributorService';

/**
 * Service for handling group contributions
 * Supports two payment methods:
 * 1. Card/Bank Payment (via app) - Automatic voting rights
 * 2. Account Number Transfer - Manual verification required
 */
export const GroupContributionService = {
  /**
   * Contribute via Card/Bank Payment (Preferred Method)
   * This grants automatic voting rights
   */
  async contributeViaPayment(
    groupId: string,
    userId: string,
    amount: number,
    paymentReference: string,
    anonymous: boolean = false
  ) {
    try {
      // Create transaction record
      const transactionData = {
        user_id: userId,
        contribution_id: groupId,
        type: 'contribution' as const,
        amount: amount,
        description: `Contribution to group via payment`,
        status: 'completed' as const,
        payment_method: 'card',
        reference_id: paymentReference,
        metadata: {
          contributionId: groupId,
          anonymous,
          votingRightsGranted: true,
          paymentMethod: 'card_payment'
        }
      };

      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (txError) throw txError;

      // Add/update contributor with voting rights
      await ContributorService.addContributor(groupId, userId, amount, anonymous);

      // Update group current amount
      await this.updateGroupAmount(groupId, amount);

      toast.success('Contribution successful! You now have voting rights in this group.');
      return transaction;
    } catch (error) {
      console.error('Error contributing via payment:', error);
      toast.error('Failed to process contribution');
      throw error;
    }
  },

  /**
   * Record bank transfer contribution (No automatic voting rights)
   * Admin must manually verify and grant voting rights
   */
  async recordBankTransfer(
    groupId: string,
    amount: number,
    senderInfo: {
      senderName?: string;
      senderBank?: string;
      accountNumber?: string;
      reference?: string;
    }
  ) {
    try {
      // Record as anonymous contributor without voting rights
      const contributorData = await ContributorService.recordBankTransfer(groupId, amount, senderInfo);

      // Update group amount
      await this.updateGroupAmount(groupId, amount);

      // Create transaction record for tracking
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: null, // Unknown user
          contribution_id: groupId,
          type: 'contribution',
          amount: amount,
          description: `Bank transfer from ${senderInfo.senderName || 'Unknown'}`,
          status: 'completed',
          payment_method: 'bank_transfer',
          reference_id: senderInfo.reference || `BANK_${Date.now()}`,
          metadata: {
            contributionId: groupId,
            senderName: senderInfo.senderName,
            senderBank: senderInfo.senderBank,
            accountNumber: senderInfo.accountNumber,
            requiresVerification: true,
            votingRightsGranted: false
          }
        });

      if (txError) throw txError;

      return contributorData;
    } catch (error) {
      console.error('Error recording bank transfer:', error);
      throw error;
    }
  },

  /**
   * Update group's current amount
   */
  async updateGroupAmount(groupId: string, amount: number) {
    try {
      const { data: group, error: fetchError } = await supabase
        .from('contribution_groups')
        .select('current_amount')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

      const newAmount = (group.current_amount || 0) + amount;

      const { error: updateError } = await supabase
        .from('contribution_groups')
        .update({
          current_amount: newAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating group amount:', error);
      throw error;
    }
  },

  /**
   * Check if user has contributed to a group
   */
  async hasContributed(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking contribution:', error);
      return false;
    }
  },

  /**
   * Check if user has voting rights in a group
   */
  async hasVotingRights(groupId: string, userId: string): Promise<boolean> {
    return ContributorService.hasVotingRights(groupId, userId);
  },

  /**
   * Get all contributors for a group
   */
  async getGroupContributors(groupId: string) {
    return ContributorService.getGroupContributors(groupId);
  },

  /**
   * Get pending bank transfers (for admin review)
   */
  async getPendingBankTransfers(groupId: string) {
    return ContributorService.getPendingBankTransfers(groupId);
  },

  /**
   * Admin: Manually verify and add contributor from bank transfer
   */
  async verifyBankTransfer(
    groupId: string,
    contributorId: string,
    userId: string,
    amount: number,
    grantVotingRights: boolean = true
  ) {
    try {
      // Check if user is admin
      const { data: group } = await supabase
        .from('contribution_groups')
        .select('creator_id')
        .eq('id', groupId)
        .single();

      if (!group) throw new Error('Group not found');

      // Manually add contributor with voting rights
      await ContributorService.manuallyAddContributor(
        groupId,
        userId,
        amount,
        grantVotingRights,
        'Verified bank transfer'
      );

      // Remove the pending bank transfer record
      await ContributorService.removeContributor(contributorId);

      toast.success('Bank transfer verified and contributor added');
    } catch (error) {
      console.error('Error verifying bank transfer:', error);
      toast.error('Failed to verify bank transfer');
      throw error;
    }
  }
};
