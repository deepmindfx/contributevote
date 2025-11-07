import { useState, useEffect } from 'react';
import { ContributorService } from '@/services/supabase/contributorService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';

/**
 * Hook to check if current user has voting rights in a group
 */
export function useVotingRights(groupId: string | undefined) {
  const [hasVotingRights, setHasVotingRights] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useSupabaseUser();

  useEffect(() => {
    if (!groupId || !user) {
      setHasVotingRights(false);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    checkRights();
  }, [groupId, user]);

  const checkRights = async () => {
    if (!groupId || !user) return;

    try {
      setLoading(true);
      
      // Check voting rights
      const votingRights = await ContributorService.hasVotingRights(groupId, user.id);
      setHasVotingRights(votingRights);

      // Check if user is admin
      const adminStatus = await ContributorService.isGroupAdmin(groupId, user.id);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error checking voting rights:', error);
      setHasVotingRights(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    checkRights();
  };

  return {
    hasVotingRights,
    isAdmin,
    loading,
    refresh,
    canVote: hasVotingRights || isAdmin, // Admins can always vote
  };
}
