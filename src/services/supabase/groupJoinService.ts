import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const shareSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publicGroupColumns = 'id,share_slug,name,description,category,privacy,cover_image_url,target_amount,frequency,contribution_amount,end_date,enable_voting_rights,voting_threshold';

export interface JoinGroupResult {
  success: boolean;
  message?: string;
  error?: string;
  group?: any;
}

export const GroupJoinService = {
  /**
   * Join a public group
   */
  async joinGroup(userId: string, groupId: string): Promise<JoinGroupResult> {
    try {
      // Check if group exists and is public
      const { data: group, error: groupError } = await supabase
        .from('contribution_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        return {
          success: false,
          error: 'Group not found'
        };
      }

      if (group.status !== "active" || group.archived) {
        return { success: false, error: "This group is no longer accepting members." };
      }
      if (group.privacy !== 'public') {
        return {
          success: false,
          error: 'This group is not public. You need an invitation to join.'
        };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMember) {
        return {
          success: true,
          message: 'You are already a member of this group',
          group
        };
      }

      // Add user as a member (without voting rights until they contribute)
      const { error: joinError } = await supabase
        .from('contributors')
        .insert({
          group_id: groupId,
          user_id: userId,
          total_contributed: 0,
          contribution_count: 0,
          has_voting_rights: false,
          join_method: 'link',
          anonymous: false,
          joined_at: new Date().toISOString()
        } as any);

      if (joinError) {
        console.error('Error joining group:', joinError);
        return {
          success: false,
          error: 'Failed to join group'
        };
      }

      toast.success('Successfully joined the group!', {
        description: 'You can now contribute and participate'
      });

      return {
        success: true,
        message: 'Successfully joined the group',
        group
      };
    } catch (error) {
      console.error('Error in joinGroup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Get group info for join page (public groups only)
   */
  async getPublicGroupInfo(groupLink: string) {
    const key = groupLink.toLowerCase();
    if (key.length > 80 || !shareSlug.test(key)) return null;
    const { data: group, error } = await supabase
      .from('contribution_groups')
      .select(publicGroupColumns)
      .eq(uuid.test(key) ? 'id' : 'share_slug', key)
      .eq('privacy', 'public')
      .eq('status', 'active')
      .or('archived.is.null,archived.eq.false')
      .maybeSingle();
    if (error) throw error;
    return group;
  },

  getJoinPath(groupId: string, slug?: string | null): string {
    return `/join/${encodeURIComponent(slug && shareSlug.test(slug) ? slug : groupId)}`;
  },

  generateShareLink(groupId: string, slug?: string | null): string {
    return window.location.origin + GroupJoinService.getJoinPath(groupId, slug);
  },

  /**
   * Generate share text for social media
   */
  generateShareText(groupName: string, groupDescription: string, shareLink: string): string {
    return `Join "${groupName}" on CollectiPay

${groupDescription}

Open this link to join and contribute:
${shareLink}

Powered by CollectiPay`;
  }
};
