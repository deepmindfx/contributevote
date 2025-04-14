
import { toast } from 'sonner';
import { 
  createWithdrawalRequest,
  voteOnWithdrawalRequest,
  pingGroupMembersForVote,
} from '@/services/localStorage';

export const useWithdrawalActions = (user: any, contributions: any[], refreshContributionData: () => void) => {
  const requestWithdrawal = (request: any) => {
    try {
      // Check if user has set up a PIN
      if (!user.pin) {
        toast.error('Please set up a transaction PIN in settings before requesting withdrawals');
        return;
      }
      
      const contribution = contributions.find((c: any) => c.id === request.contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      // Check if user is the creator of the group
      if (contribution.creatorId !== user.id) {
        toast.error('Only the group creator can request withdrawals');
        return;
      }
      
      if (contribution.currentAmount < request.amount) {
        toast.error('Requested amount exceeds available funds');
        return;
      }
      
      createWithdrawalRequest(request);
      refreshContributionData();
      toast.success('Withdrawal request submitted for voting');
    } catch (error) {
      toast.error('Failed to create withdrawal request');
      console.error(error);
    }
  };

  const vote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      voteOnWithdrawalRequest(requestId, vote);
      refreshContributionData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to submit vote');
      }
      console.error(error);
    }
  };
  
  const pingMembersForVote = (requestId: string) => {
    try {
      pingGroupMembersForVote(requestId);
      toast.success('Reminder sent to all members who have not voted yet');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to send reminders');
      }
      console.error(error);
    }
  };

  return {
    requestWithdrawal,
    vote,
    pingMembersForVote,
  };
};
