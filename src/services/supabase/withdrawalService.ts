import { supabase } from '@/integrations/supabase/client';

export interface WithdrawalRequest {
  id: string;
  contribution_id: string;
  requester_id: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  deadline: string;
  votes: Array<{
    user_id: string;
    vote: boolean;
    voted_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface VotingStatus {
  success: boolean;
  status: string;
  participation_rate: number;
  approval_rate: number;
  voting_threshold?: number;
  votes_cast: number;
  yes_votes?: number;
  no_votes?: number;
  total_voters: number;
  error?: string;
}

/**
 * Create a withdrawal request atomically via server-side RPC
 * Enforces creator ownership, active status, available pool balance, eligible voters > 0, and notifies voters.
 */
export async function createWithdrawalRequest(
  groupId: string,
  amount: number,
  purpose: string,
  pin?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await (supabase as any).rpc('create_withdrawal_request_safe', {
      p_group_id: groupId,
      p_amount: amount,
      p_purpose: purpose.trim(),
      p_pin: pin || null,
    });

    if (error) throw error;

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Failed to create withdrawal request',
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create withdrawal request',
    };
  }
}

/**
 * Cast a vote on a withdrawal request atomically via server-side RPC.
 * Locks row, verifies has_voting_rights = true, records audit transaction,
 * and evaluates 70% participation + group's configured voting_threshold%.
 */
export async function voteOnWithdrawal(
  withdrawalId: string,
  vote: boolean
): Promise<{ success: boolean; votingStatus?: VotingStatus; error?: string }> {
  try {
    const { data, error } = await (supabase as any).rpc('cast_withdrawal_vote', {
      p_withdrawal_id: withdrawalId,
      p_vote: vote,
    });

    if (error) throw error;

    const status = data as VotingStatus;
    if (!status?.success) {
      return {
        success: false,
        error: status?.error || 'Failed to record vote',
      };
    }

    return { success: true, votingStatus: status };
  } catch (error) {
    console.error('Error voting on withdrawal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to vote',
    };
  }
}

/**
 * Check withdrawal voting status and auto-approve/reject if thresholds met
 */
export async function checkWithdrawalVoting(
  withdrawalId: string
): Promise<VotingStatus> {
  try {
    const { data, error } = await supabase.rpc('check_withdrawal_voting', {
      p_withdrawal_id: withdrawalId,
    });

    if (error) throw error;

    return data as unknown as VotingStatus;
  } catch (error) {
    console.error('Error checking withdrawal voting:', error);
    return {
      success: false,
      status: 'error',
      participation_rate: 0,
      approval_rate: 0,
      votes_cast: 0,
      total_voters: 0,
    };
  }
}

/**
 * Get withdrawal requests for a group
 */
export async function getWithdrawalRequests(
  groupId: string
): Promise<WithdrawalRequest[]> {
  try {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('contribution_id', groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data as unknown as WithdrawalRequest[]) || [];
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    return [];
  }
}

/**
 * Get user's vote on a withdrawal
 */
export async function getUserVote(
  withdrawalId: string,
  userId: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('votes')
      .eq('id', withdrawalId)
      .single();

    if (error) throw error;

    const votes: any[] = Array.isArray(data.votes) ? (data.votes as any[]) : [];
    const userVote = votes.find((v: any) => v.user_id === userId);

    return userVote ? userVote.vote : null;
  } catch (error) {
    console.error('Error getting user vote:', error);
    return null;
  }
}

/**
 * Process instant withdrawal (for groups without voting)
 */
export async function processInstantWithdrawal(
  groupId: string,
  amount: number,
  purpose: string,
  pin?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { error } = await (supabase as any).rpc('process_instant_withdrawal', {
      p_group_id: groupId,
      p_admin_id: userId,
      p_amount: amount,
      p_purpose: purpose,
      p_pin: pin || null,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error processing instant withdrawal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process withdrawal',
    };
  }
}
