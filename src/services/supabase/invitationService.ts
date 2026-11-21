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
      const normalizedEmail = inviteeEmail.trim().toLowerCase();

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
          error: "Public groups don't require invitations. Share the group link instead."
        };
      }

      // Safely resolve invitee user ID by email (if registered) and check membership
      const { data: inviteeUserId } = await (supabase as any).rpc('lookup_user_id_by_email', {
        p_email: normalizedEmail
      });

      if (inviteeUserId) {
        const { data: existingMember } = await supabase
          .from('contributors')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', inviteeUserId)
          .maybeSingle();

        if (existingMember) {
          return {
            success: false,
            error: 'User is already a member of this group'
          };
        }
      }

      // Check if pending invitation already exists
      const { data: existingInvite } = await (supabase as any)
        .from('group_invitations')
        .select('*')
        .eq('group_id', groupId)
        .eq('invitee_email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        return {
          success: false,
          error: 'An invitation has already been sent to this email'
        };
      }

      // Generate secure invitation token
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const token = `inv_${randomPart}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invitation, error: inviteError } = await (supabase as any)
        .from('group_invitations')
        .insert({
          group_id: groupId,
          inviter_id: inviterUserId,
          invitee_email: normalizedEmail,
          invitee_id: inviteeUserId || null,
          status: 'pending',
          token,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Notify invitee in-app if they already have an account
      if (inviteeUserId) {
        await supabase.from('notifications').insert({
          user_id: inviteeUserId,
          type: 'group_invitation',
          title: 'Private Group Invitation',
          message: `You were invited to join "${group.name}".`,
          related_id: groupId,
          is_read: false
        } as any);
      }

      const inviteLink = `${window.location.origin}/invite/${token}`;
      toast.success(`Invitation created for ${normalizedEmail}`);

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
   * Get invitation by token (works for both signed-out and signed-in users via RPC)
   */
  async getInvitationByToken(token: string) {
    try {
      const { data, error } = await (supabase as any).rpc('get_invitation_by_token', {
        p_token: token
      });

      if (error) throw error;
      if (!data?.success) {
        return {
          success: false,
          error: data?.error || 'Invitation not found'
        };
      }

      return {
        success: true,
        invitation: data.invitation
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
      const inviteResult = await this.getInvitationByToken(token);
      if (!inviteResult.success || !inviteResult.invitation) {
        return inviteResult;
      }

      const invitation = inviteResult.invitation;

      if (invitation.status !== 'pending') {
        return {
          success: false,
          error: 'This invitation has already been used or expired'
        };
      }

      // Check if user is already a contributor
      const { data: existingMember } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', invitation.group_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingMember) {
        const { error: contributorError } = await supabase
          .from('contributors')
          .insert({
            group_id: invitation.group_id,
            user_id: userId,
            amount: 0,
            total_contributed: 0,
            contribution_count: 0,
            has_voting_rights: false,
            join_method: 'invitation',
            anonymous: false,
            joined_at: new Date().toISOString()
          } as any);

        if (contributorError) throw contributorError;
      }

      const { error: updateError } = await (supabase as any)
        .from('group_invitations')
        .update({
          status: 'accepted',
          invitee_id: userId,
          accepted_at: new Date().toISOString()
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
      const { data, error } = await (supabase as any)
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
      const { error } = await (supabase as any)
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
