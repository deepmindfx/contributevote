import { supabase } from '@/integrations/supabase/client';

// Category definitions (visual icons rendered via CategoryIcon component)
export const CATEGORIES = [
  { value: 'personal', label: 'Personal', icon: 'user' },
  { value: 'family', label: 'Family', icon: 'users' },
  { value: 'community', label: 'Community', icon: 'building-2' },
  { value: 'business', label: 'Business', icon: 'briefcase' },
  { value: 'event', label: 'Event', icon: 'sparkles' },
  { value: 'education', label: 'Education', icon: 'graduation-cap' },
  { value: 'charity', label: 'Charity', icon: 'heart-handshake' },
  { value: 'health', label: 'Health', icon: 'heart-pulse' },
  { value: 'travel', label: 'Travel', icon: 'plane' },
  { value: 'investment', label: 'Investment', icon: 'trending-up' },
  { value: 'emergency', label: 'Emergency', icon: 'shield-alert' },
  { value: 'wedding', label: 'Wedding', icon: 'gem' },
  { value: 'birthday', label: 'Birthday', icon: 'cake' },
  { value: 'funeral', label: 'Funeral', icon: 'flower-2' },
  { value: 'religious', label: 'Religious', icon: 'landmark' },
  { value: 'sports', label: 'Sports', icon: 'trophy' },
  { value: 'entertainment', label: 'Entertainment', icon: 'ticket' },
  { value: 'housing', label: 'Housing', icon: 'home' },
  { value: 'other', label: 'Other', icon: 'layers' },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

// Verify & save user BVN for mandatory AML/KYC group creation gate
export async function saveUserBvn(
  bvn: string
): Promise<{ success: boolean; bvn_last4?: string; message?: string; error?: string; code?: string }> {
  const { data, error } = await (supabase as any).rpc('save_user_bvn', {
    p_bvn: bvn.replace(/\D/g, '').slice(0, 11),
  });
  if (error) throw error;
  return data;
}

// Check if user can create group for free or needs to pay
export async function checkGroupCreationEligibility(userId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('check_group_creation_eligibility', {
      p_user_id: userId,
    } as any);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking group creation eligibility:', error);
    throw error;
  }
}

// Create group with automatic fee deduction
export async function createGroupWithFee(
  userId: string,
  groupData: {
    name: string;
    description: string;
    target_amount: number;
    category: string;
    frequency: string;
    privacy?: string;
    enable_voting_rights?: boolean;
    contribution_amount?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    voting_threshold?: number | null;
    cover_image_url?: string | null;
  },
  authorization: { expectedFee: number; requestId: string },
): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('create_group_with_fee_check', {
      p_user_id: userId,
      p_name: groupData.name,
      p_description: groupData.description,
      p_target_amount: groupData.target_amount,
      p_category: groupData.category,
      p_frequency: groupData.frequency,
      p_privacy: groupData.privacy || 'public',
      p_enable_voting_rights: groupData.enable_voting_rights !== false,
      p_contribution_amount: groupData.contribution_amount ?? null,
      p_start_date: groupData.start_date || null,
      p_end_date: groupData.end_date || null,
      p_voting_threshold: groupData.voting_threshold ?? 60,
      p_cover_image_url: groupData.cover_image_url || null,
      p_expected_fee: authorization.expectedFee,
      p_request_id: authorization.requestId,
    } as any);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating group with fee:', error);
    throw error;
  }
}

// Archive a group
export async function archiveGroup(groupId: string, userId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('archive_group', {
      p_group_id: groupId,
      p_user_id: userId,
    } as any);

    if (error) throw error;
    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) throw new Error(result?.error || 'Could not archive the group.');
    return data;
  } catch (error) {
    console.error('Error archiving group:', error);
    throw error;
  }
}

// Unarchive a group
export async function unarchiveGroup(groupId: string, userId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('unarchive_group', {
      p_group_id: groupId,
      p_user_id: userId,
    } as any);

    if (error) throw error;
    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) throw new Error(result?.error || 'Could not unarchive the group.');
    return data;
  } catch (error) {
    console.error('Error unarchiving group:', error);
    throw error;
  }
}

// Get groups with sorting and filtering
export async function getGroupsSorted(
  userId: string,
  options: {
    sortBy?: 'date' | 'category' | 'progress';
    showArchived?: boolean;
    category?: string;
  } = {}
) {
  try {
    // Get groups where user is creator (include contributor count)
    let creatorQuery = supabase
      .from('contribution_groups')
      .select('*, contributors(count)')
      .eq('creator_id', userId);

    // Filter archived
    if (!options.showArchived) {
      creatorQuery = creatorQuery.eq('archived', false);
    }

    // Filter by category
    if (options.category && options.category !== 'all') {
      creatorQuery = creatorQuery.eq('category', options.category);
    }

    const { data: creatorGroups, error: creatorError } = await creatorQuery;
    if (creatorError) throw creatorError;

    // Get groups where user is a contributor (but not creator)
    const { data: contributorData, error: contributorError } = await supabase
      .from('contributors')
      .select('group_id')
      .eq('user_id', userId);

    if (contributorError) throw contributorError;

    const contributorGroupIds = contributorData?.map(c => c.group_id) || [];

    // Fetch contributor groups
    let contributorGroups: any[] = [];
    if (contributorGroupIds.length > 0) {
      let contributorGroupQuery = supabase
        .from('contribution_groups')
        .select('*, contributors(count)')
        .in('id', contributorGroupIds)
        .neq('creator_id', userId); // Exclude groups where user is creator (already fetched)

      // Filter archived
      if (!options.showArchived) {
        contributorGroupQuery = contributorGroupQuery.eq('archived', false);
      }

      // Filter by category
      if (options.category && options.category !== 'all') {
        contributorGroupQuery = contributorGroupQuery.eq('category', options.category);
      }

      const { data, error } = await contributorGroupQuery;
      if (error) throw error;
      contributorGroups = data || [];
    }

    // Combine both lists
    const allGroups = [...(creatorGroups || []), ...contributorGroups];

    // Sort the combined list
    switch (options.sortBy) {
      case 'date':
        allGroups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'category':
        allGroups.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        break;
      case 'progress':
        allGroups.sort((a, b) => (b.current_amount || 0) - (a.current_amount || 0));
        break;
      default:
        allGroups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return allGroups;
  } catch (error) {
    console.error('Error getting sorted groups:', error);
    throw error;
  }
}

// Get category icon key (render with <CategoryIcon category={...} />)
export function getCategoryIcon(category: string): string {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.icon || 'layers';
}

// Get category label
export function getCategoryLabel(category: string): string {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.label || 'Other';
}
