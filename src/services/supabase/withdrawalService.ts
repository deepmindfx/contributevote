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
  votes_cast: number;
  total_voters: number;
}

/**
 * Create a withdrawal request
 */
export async function createWithdrawalRequest(
  groupId: string,
  amount: number,
  purpose: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 7 days from now

    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        contribution_id: groupId,
        requester_id: (await supabase.auth.getUser()).data.user?.id,
        amount,
        purpose,
        deadline: deadline.toISOString(),
        status: 'pending',
        votes: []
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create withdrawal request'
    };
  }
}

/**
 * Vote on a withdrawal request
 */
export async function voteOnWithdrawal(
  withdrawalId: string,
  vote: boolean
): Promise<{ success: boolean; votingStatus?: VotingStatus; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    // Get current withdrawal
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (fetchError) throw fetchError;

    // Check if user already voted
    const votes = withdrawal.votes || [];
    const existingVoteIndex = votes.findIndex((v: any) => v.user_id === userId);

    if (existingVoteIndex >= 0) {
      // Update existing vote
      votes[existingVoteIndex] = {
        user_id: userId,
        vote,
        voted_at: new Date().toISOString()
      };
    } else {
      // Add new vote
      votes.push({
        user_id: userId,
        vote,
        voted_at: new Date().toISOString()
      });
    }

    // Update withdrawal with new votes
    const { error: updateError } = await supabase
      .from('withdrawal_requests')
      .update({ votes, updated_at: new Date().toISOString() })
      .eq('id', withdrawalId);

    if (updateError) throw updateError;

    // Record the vote as a transaction for activity history
    const { error: recordError } = await supabase.rpc('record_withdrawal_vote', {
      p_withdrawal_id: withdrawalId,
      p_user_id: userId,
      p_vote: vote
    });

    if (recordError) {
      console.error('Error recording vote transaction:', recordError);
      // Don't fail the vote operation if transaction recording fails
    }

    // Check voting status and auto-approve/reject if thresholds met
    const votingStatus = await checkWithdrawalVoting(withdrawalId);

    return { success: true, votingStatus };
  } catch (error) {
    console.error('Error voting on withdrawal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to vote'
    };
  }
}

/**
 * Check withdrawal voting status and auto-approve/reject
 */
export async function checkWithdrawalVoting(
  withdrawalId: string
): Promise<VotingStatus> {
  try {
    const { data, error } = await supabase.rpc('check_withdrawal_voting', {
      p_withdrawal_id: withdrawalId
    });

    if (error) throw error;

    return data as VotingStatus;
  } catch (error) {
    console.error('Error checking withdrawal voting:', error);
    return {
      success: false,
      status: 'error',
      participation_rate: 0,
      approval_rate: 0,
      votes_cast: 0,
      total_voters: 0
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

    return data || [];
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

    const votes = data.votes || [];
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
  purpose: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('process_instant_withdrawal', {
      p_group_id: groupId,
      p_admin_id: userId,
      p_amount: amount,
      p_purpose: purpose
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error processing instant withdrawal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process withdrawal'
    };
  }
}
