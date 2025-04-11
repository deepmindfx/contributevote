
import { toast } from 'sonner';
import { generateContributionReceipt } from '@/services/localStorage';

export const getReceipt = (transactionId: string) => {
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
