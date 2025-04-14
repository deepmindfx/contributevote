
import { toast } from 'sonner';
import { 
  createContribution,
  contributeToGroup,
  contributeByAccountNumber,
  generateShareLink,
  generateContributionReceipt,
} from '@/services/localStorage';
import { shareContributionToContacts } from '../utils';

export const useContributionActions = (
  user: any, 
  contributions: any[], 
  refreshContributionData: () => void,
  getUserByEmail: Function, 
  getUserByPhone: Function
) => {
  const createNewContribution = (contribution: any) => {
    try {
      createContribution(contribution);
      refreshContributionData();
      toast.success('Contribution group created successfully!');
    } catch (error) {
      toast.error('Failed to create contribution group');
      console.error(error);
    }
  };

  const contribute = (contributionId: string, amount: number, anonymous: boolean = false) => {
    try {
      if (user.walletBalance < amount) {
        toast.error('Insufficient funds in your wallet');
        return;
      }
      
      contributeToGroup(contributionId, amount, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      toast.error('Failed to make contribution');
      console.error(error);
    }
  };

  const contributeViaAccountNumber = (accountNumber: string, amount: number, contributorInfo: { name: string, email?: string, phone?: string }, anonymous: boolean = false) => {
    try {
      contributeByAccountNumber(accountNumber, amount, contributorInfo, anonymous);
      refreshContributionData();
      toast.success('Contribution successful!');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to make contribution');
      }
      console.error(error);
    }
  };

  const getShareLink = (contributionId: string) => {
    return generateShareLink(contributionId);
  };
  
  const shareToContacts = (contributionId: string, recipients: string[]) => {
    try {
      const contribution = contributions.find((c: any) => c.id === contributionId);
      
      if (!contribution) {
        toast.error('Contribution not found');
        return;
      }
      
      shareContributionToContacts(contributionId, recipients, contribution, user.id, user.name, getUserByEmail, getUserByPhone);
      
      toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
      refreshContributionData();
    } catch (error) {
      toast.error('Failed to share contribution');
      console.error(error);
    }
  };
  
  const getReceipt = (transactionId: string) => {
    try {
      const receipt = generateContributionReceipt(transactionId);
      if (!receipt) {
        toast.error('Unable to generate receipt for this transaction');
        return null;
      }
      return receipt;
    } catch (error) {
      toast.error('Failed to generate receipt');
      console.error(error);
      return null;
    }
  };

  return {
    createNewContribution,
    contribute,
    contributeViaAccountNumber,
    getShareLink,
    shareToContacts,
    getReceipt,
  };
};
