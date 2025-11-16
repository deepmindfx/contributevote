import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Invitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_id?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
  token: string;
}

export const InvitationService = {
  /**
   * Send invitation to join a private group
   */
  async sendInvitation(groupId: string, inviterUserId: string, inviteeEmail: string) {
    try {
      // Check if group is private
      const { data: group, error: groupError } = await supabase
        .from('contribution_groups')
        .select('privacy, name')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      if (group.privacy === 'public') {
        return {
          success: false,
          error: 'Public groups don\'t require invitations. Share the group link instead.'
        };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', inviteeEmail) // Will check by email later
        .single();

      if (existingMember) {
        return {
          success: false,
          error: 'User is already a member of this group'
        };
      }

      // Check if invitation already exists
      const { data: existingInvite } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .eq('invitee_email', inviteeEmail)
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        return {
          success: false,
          error: 'An invitation has already been sent to this email'
        };
      }

      // Generate invitation token
      const token = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('group_invitations')
        .insert({
          group_id: groupId,
          inviter_id: inviterUserId,
          invitee_email: inviteeEmail,
          status: 'pending',
          token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // TODO: Send email notification with invitation link
      // For now, just return the invitation link
      const inviteLink = `${window.location.origin}/invite/${token}`;

      toast.success(`Invitation sent to ${inviteeEmail}`);

      return {
        success: true,
        invitation,
        inviteLink
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invitation'
      };
    }
  },

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string) {
    try {
      const { data, error } = await supabase
        .from('group_invitations')
        .select(`
          *,
          group:contribution_groups(*),
          inviter:profiles!inviter_id(name, email)
        `)
        .eq('token', token)
        .single();

      if (error) throw error;

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        await supabase
          .from('group_invitations')
          .update({ status: 'expired' })
          .eq('id', data.id);

        return {
          success: false,
          error: 'This invitation has expired'
        };
      }

      return {
        success: true,
        invitation: data
      };
    } catch (error) {
      console.error('Error getting invitation:', error);
      return {
        success: false,
        error: 'Invitation not found'
      };
    }
  },

  /**
   * Accept invitation and join group
   */
  async acceptInvitation(token: string, userId: string) {
    try {
      // Get invitation
      const inviteResult = await this.getInvitationByToken(token);
      if (!inviteResult.success || !inviteResult.invitation) {
        return inviteResult;
      }

      const invitation = inviteResult.invitation;

      // Check if already accepted
      if (invitation.status !== 'pending') {
        return {
          success: false,
          error: 'This invitation has already been used'
        };
      }

      // Add user as contributor
      const { error: contributorError } = await supabase
        .from('contributors')
        .insert({
          group_id: invitation.group_id,
          user_id: userId,
          total_contributed: 0,
          contribution_count: 0,
          has_voting_rights: false,
          join_method: 'invitation',
          anonymous: false,
          joined_at: new Date().toISOString()
        });

      if (contributorError) throw contributorError;

      // Update invitation status
      const { error: updateError } = await supabase
        .from('group_invitations')
        .update({
          status: 'accepted',
          invitee_id: userId
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      toast.success('Successfully joined the group!');

      return {
        success: true,
        groupId: invitation.group_id
      };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept invitation'
      };
    }
  },

  /**
   * Get pending invitations for a group
   */
  async getGroupInvitations(groupId: string) {
    try {
      const { data, error } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting group invitations:', error);
      return [];
    }
  },

  /**
   * Cancel/revoke an invitation
   */
  async cancelInvitation(invitationId: string) {
    try {
      const { error } = await supabase
        .from('group_invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);

      if (error) throw error;

      toast.success('Invitation cancelled');
      return { success: true };
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
      return { success: false };
    }
  }
};
