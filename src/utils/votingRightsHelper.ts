import { ContributorService } from '@/services/supabase/contributorService';
import { toast } from 'sonner';

/**
 * Check if user has voting rights before performing an action
 * Shows appropriate error message if they don't
 */
export async function checkVotingRights(
  groupId: string,
  userId: string,
  actionName: string = 'perform this action'
): Promise<boolean> {
  try {
    const hasRights = await ContributorService.hasVotingRights(groupId, userId);
    
    if (!hasRights) {
      toast.error(
        `You need to contribute to this group to ${actionName}`,
        {
          description: 'Contribute via card/bank to get voting rights',
          duration: 5000,
        }
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking voting rights:', error);
    toast.error('Failed to verify voting rights');
    return false;
  }
}

/**
 * Check if user is admin of the group
 */
export async function checkIsAdmin(
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    return await ContributorService.isGroupAdmin(groupId, userId);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if user can perform admin actions
 */
export async function checkAdminRights(
  groupId: string,
  userId: string,
  actionName: string = 'perform this action'
): Promise<boolean> {
  try {
    const isAdmin = await ContributorService.isGroupAdmin(groupId, userId);
    
    if (!isAdmin) {
      toast.error(
        `Only group admins can ${actionName}`,
        {
          description: 'Contact the group creator for assistance',
          duration: 5000,
        }
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking admin rights:', error);
    toast.error('Failed to verify admin rights');
    return false;
  }
}

/**
 * Example usage in a voting function
 */
export async function handleVote(
  groupId: string,
  userId: string,
  voteData: any
) {
  // Check voting rights first
  const canVote = await checkVotingRights(groupId, userId, 'vote');
  
  if (!canVote) {
    return; // User doesn't have voting rights
  }
  
  // Proceed with voting logic
  try {
    // Your voting logic here
    console.log('Processing vote:', voteData);
    toast.success('Vote recorded successfully!');
  } catch (error) {
    console.error('Error voting:', error);
    toast.error('Failed to record vote');
  }
}

/**
 * Example usage in an admin function
 */
export async function handleAdminAction(
  groupId: string,
  userId: string,
  actionData: any
) {
  // Check admin rights first
  const isAdmin = await checkAdminRights(groupId, userId, 'perform this action');
  
  if (!isAdmin) {
    return; // User is not admin
  }
  
  // Proceed with admin action
  try {
    // Your admin logic here
    console.log('Processing admin action:', actionData);
    toast.success('Action completed successfully!');
  } catch (error) {
    console.error('Error performing action:', error);
    toast.error('Failed to complete action');
  }
}
