
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

// Add a function to handle transaction errors gracefully
export const handleTransactionError = (error: unknown, defaultMessage: string = 'Transaction failed') => {
  console.error('Transaction error:', error);
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error(defaultMessage);
  }
  return null;
};
