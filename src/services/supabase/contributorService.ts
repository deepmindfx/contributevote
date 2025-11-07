import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ContributorService = {
  /**
   * Record a pending contribution immediately after payment
   * Voting rights will be granted when webhook confirms
   */
  async recordPendingContribution(
    groupId: string,
    userId: string,
    amount: number,
    paymentDetails: {
      txRef: string;
      flwRef: string;
      transactionId: number;
      paymentType: string;
    }
  ) {
    try {
      // Check if contributor already exists
      const { data: existing } = await supabase
        .from('contributors')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        // Update existing contributor - add to pending amount
        const { error } = await supabase
          .from('contributors')
          .update({
            total_contributed: (existing as any).total_contributed + amount,
            contribution_count: (existing as any).contribution_count + 1,
            last_contribution_at: new Date().toISOString(),
            // Keep has_voting_rights as is (will be set to true by webhook)
            metadata: {
              ...(existing as any).metadata,
              lastPayment: paymentDetails,
              pendingConfirmation: true
            }
          } as any)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new contributor with pending status
        const { error } = await supabase
          .from('contributors')
          .insert({
            group_id: groupId,
            user_id: userId,
            total_contributed: amount,
            contribution_count: 1,
            has_voting_rights: false, // Will be set to true by webhook
            join_method: 'card_payment',
            anonymous: false,
            joined_at: new Date().toISOString(),
            last_contribution_at: new Date().toISOString(),
            metadata: {
              paymentDetails,
              pendingConfirmation: true,
              note: 'Awaiting webhook confirmation'
            }
          } as any);

        if (error) throw error;
      }

      // Update group current amount (since payment is already successful)
      const { data: group } = await supabase
        .from('contribution_groups')
        .select('current_amount')
        .eq('id', groupId)
        .single();

      if (group) {
        await supabase
          .from('contribution_groups')
          .update({
            current_amount: (group.current_amount || 0) + amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', groupId);
      }

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          contribution_id: groupId,
          type: 'deposit',
          amount: amount,
          description: `Contribution via ${paymentDetails.paymentType}`,
          reference_id: paymentDetails.flwRef,
          payment_method: paymentDetails.paymentType,
          status: 'pending', // Will be updated to 'completed' by webhook
          metadata: {
            ...paymentDetails,
            pendingWebhookConfirmation: true
          }
        } as any);

      toast.success('Contribution recorded successfully!');
    } catch (error) {
      console.error('Error recording pending contribution:', error);
      throw error;
    }
  },

  /**
   * Add or update a contributor when they make a payment via card/bank
   * This grants them voting rights
   */
  async addContributor(groupId: string, userId: string, amount: number, anonymous: boolean = false) {
    try {
      // Check if contributor already exists
      const { data: existing } = await supabase
        .from('contributors')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Update existing contributor
        const { data, error } = await supabase
          .from('contributors')
          .update({
            total_contributed: (existing as any).total_contributed + amount,
            contribution_count: (existing as any).contribution_count + 1,
            last_contribution_at: new Date().toISOString(),
            has_voting_rights: true,
            anonymous
          } as any)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new contributor with voting rights
        const { data, error } = await supabase
          .from('contributors')
          .insert({
            group_id: groupId,
            user_id: userId,
            total_contributed: amount,
            contribution_count: 1,
            has_voting_rights: true,
            join_method: 'card_payment',
            anonymous,
            joined_at: new Date().toISOString(),
            last_contribution_at: new Date().toISOString()
          } as any)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error adding contributor:', error);
      throw error;
    }
  },

  /**
   * Record a bank transfer contribution (no voting rights by default)
   * Admin can manually grant voting rights later
   */
  async recordBankTransfer(groupId: string, amount: number, senderInfo: any) {
    try {
      // Create anonymous contributor entry without voting rights
      const { data, error } = await supabase
        .from('contributors')
        .insert({
          group_id: groupId,
          user_id: null,
          total_contributed: amount,
          contribution_count: 1,
          has_voting_rights: false,
          join_method: 'bank_transfer',
          anonymous: true,
          joined_at: new Date().toISOString(),
          last_contribution_at: new Date().toISOString(),
          metadata: {
            senderName: senderInfo.senderName,
            senderBank: senderInfo.senderBank,
            note: 'Bank transfer - requires manual verification for voting rights'
          }
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording bank transfer:', error);
      throw error;
    }
  },

  /**
   * Get all contributors for a group
   */
  async getGroupContributors(groupId: string) {
    try {
      const { data, error } = await supabase
        .from('contributors')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email
          )
        `)
        .eq('group_id', groupId)
        .order('total_contributed', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting contributors:', error);
      return [];
    }
  },

  /**
   * Check if user has voting rights in a group
   */
  async hasVotingRights(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contributors')
        .select('has_voting_rights')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      // maybeSingle returns null if no row found (not an error)
      if (error) {
        console.error('Error checking voting rights:', error);
        return false;
      }
      
      return (data as any)?.has_voting_rights || false;
    } catch (error) {
      console.error('Exception checking voting rights:', error);
      return false;
    }
  },

  /**
   * Admin function: Grant voting rights to a contributor
   */
  async grantVotingRights(contributorId: string) {
    try {
      const { data, error } = await supabase
        .from('contributors')
        .update({ has_voting_rights: true } as any)
        .eq('id', contributorId)
        .select()
        .single();

      if (error) throw error;
      toast.success('Voting rights granted successfully');
      return data;
    } catch (error) {
      console.error('Error granting voting rights:', error);
      toast.error('Failed to grant voting rights');
      throw error;
    }
  },

  /**
   * Admin function: Manually add a contributor (for bank transfers)
   * This allows admin to link a bank transfer to a specific user
   */
  async manuallyAddContributor(
    groupId: string, 
    userId: string, 
    amount: number, 
    grantVotingRights: boolean = true,
    note?: string
  ) {
    try {
      // Check if contributor already exists
      const { data: existing } = await supabase
        .from('contributors')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Update existing contributor
        const { data, error } = await supabase
          .from('contributors')
          .update({
            total_contributed: (existing as any).total_contributed + amount,
            contribution_count: (existing as any).contribution_count + 1,
            last_contribution_at: new Date().toISOString(),
            has_voting_rights: grantVotingRights,
            metadata: {
              ...(existing as any).metadata,
              manuallyAdded: true,
              adminNote: note,
              lastManualAddition: new Date().toISOString()
            }
          } as any)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        toast.success('Contributor updated successfully');
        return data;
      } else {
        // Create new contributor
        const { data, error } = await supabase
          .from('contributors')
          .insert({
            group_id: groupId,
            user_id: userId,
            total_contributed: amount,
            contribution_count: 1,
            has_voting_rights: grantVotingRights,
            join_method: 'manual',
            anonymous: false,
            joined_at: new Date().toISOString(),
            last_contribution_at: new Date().toISOString(),
            metadata: {
              manuallyAdded: true,
              adminNote: note,
              addedAt: new Date().toISOString()
            }
          } as any)
          .select()
          .single();

        if (error) throw error;
        toast.success('Contributor added successfully');
        return data;
      }
    } catch (error) {
      console.error('Error manually adding contributor:', error);
      toast.error('Failed to add contributor');
      throw error;
    }
  },

  /**
   * Admin function: Get pending bank transfers (contributors without voting rights)
   */
  async getPendingBankTransfers(groupId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('contributors')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter for pending bank transfers
      const pending = (data || []).filter((c: any) => 
        c.has_voting_rights === false && c.join_method === 'bank_transfer'
      );
      
      return pending;
    } catch (error) {
      console.error('Error getting pending bank transfers:', error);
      return [];
    }
  },

  /**
   * Admin function: Remove a contributor
   */
  async removeContributor(contributorId: string) {
    try {
      const { error } = await supabase
        .from('contributors')
        .delete()
        .eq('id', contributorId);

      if (error) throw error;
      toast.success('Contributor removed successfully');
    } catch (error) {
      console.error('Error removing contributor:', error);
      toast.error('Failed to remove contributor');
      throw error;
    }
  },

  /**
   * Check if user is admin (creator) of a group
   */
  async isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contribution_groups')
        .select('creator_id')
        .eq('id', groupId)
        .single();

      if (error) return false;
      return data?.creator_id === userId;
    } catch (error) {
      return false;
    }
  }
};
