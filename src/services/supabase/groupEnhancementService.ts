import { supabase } from '@/integrations/supabase/client';

// Category definitions with icons
export const CATEGORIES = [
  { value: 'personal', label: 'Personal', icon: '👤' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'community', label: 'Community', icon: '🏘️' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'event', label: 'Event', icon: '🎉' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'charity', label: 'Charity', icon: '❤️' },
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'emergency', label: 'Emergency', icon: '🚨' },
  { value: 'wedding', label: 'Wedding', icon: '💒' },
  { value: 'birthday', label: 'Birthday', icon: '🎂' },
  { value: 'funeral', label: 'Funeral', icon: '🕊️' },
  { value: 'religious', label: 'Religious', icon: '🙏' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎭' },
  { value: 'housing', label: 'Housing', icon: '🏠' },
  { value: 'other', label: 'Other', icon: '📌' },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

// Check if user can create group for free or needs to pay
export async function checkGroupCreationEligibility(userId: string) {
  try {
    const { data, error } = await supabase.rpc('check_group_creation_eligibility' as any, {
      p_user_id: userId,
    });

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
  }
) {
  try {
    const { data, error } = await supabase.rpc('create_group_with_fee_check' as any, {
      p_user_id: userId,
      p_name: groupData.name,
      p_description: groupData.description,
      p_target_amount: groupData.target_amount,
      p_category: groupData.category,
      p_frequency: groupData.frequency,
      p_privacy: groupData.privacy || 'public',
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating group with fee:', error);
    throw error;
  }
}

// Archive a group
export async function archiveGroup(groupId: string, userId: string) {
  try {
    const { data, error } = await supabase.rpc('archive_group' as any, {
      p_group_id: groupId,
      p_user_id: userId,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error archiving group:', error);
    throw error;
  }
}

// Unarchive a group
export async function unarchiveGroup(groupId: string, userId: string) {
  try {
    const { data, error } = await supabase.rpc('unarchive_group' as any, {
      p_group_id: groupId,
      p_user_id: userId,
    });

    if (error) throw error;
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
    let query = supabase
      .from('contribution_groups')
      .select('*')
      .eq('creator_id', userId);

    // Filter archived
    if (!options.showArchived) {
      query = query.eq('archived', false);
    }

    // Filter by category
    if (options.category && options.category !== 'all') {
      query = query.eq('category', options.category);
    }

    // Sort
    switch (options.sortBy) {
      case 'date':
        query = query.order('created_at', { ascending: false });
        break;
      case 'category':
        query = query.order('category');
        break;
      case 'progress':
        query = query.order('current_amount', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting sorted groups:', error);
    throw error;
  }
}

// Get category icon
export function getCategoryIcon(category: string): string {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.icon || '📌';
}

// Get category label
export function getCategoryLabel(category: string): string {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.label || 'Other';
}
