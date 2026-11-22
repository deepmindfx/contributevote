import { useQuery } from '@tanstack/react-query';
import { ContributorService } from '@/services/supabase/contributorService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';

/**
 * Hook to check if current user has voting rights in a group
 */
export function useVotingRights(groupId: string | undefined, creatorId?: string) {
  const { user } = useSupabaseUser();
  const userId = user?.id;
  const rights = useQuery({
    queryKey: ["voting-rights", userId, groupId],
    queryFn: () => ContributorService.hasVotingRights(groupId!, userId!),
    enabled: Boolean(userId && groupId),
    retry: false,
  });
  const ownership = useQuery({
    queryKey: ["group-owner", userId, groupId],
    queryFn: () => ContributorService.isGroupAdmin(groupId!, userId!),
    enabled: Boolean(userId && groupId && creatorId === undefined),
    retry: false,
  });
  const hasVotingRights = rights.data ?? false;
  return {
    hasVotingRights,
    isAdmin: creatorId === undefined ? ownership.data ?? false : creatorId === userId,
    loading: rights.isLoading || ownership.isLoading,
    refresh: () => rights.refetch(),
    canVote: hasVotingRights,
  };
}
