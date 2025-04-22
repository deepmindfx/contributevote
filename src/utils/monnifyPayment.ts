
import { v4 as uuidv4 } from 'uuid';
import { createTransaction } from '@/services/localStorage/transactionOperations';

interface MonnifyPaymentParams {
  amount: number;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  contribution?: {
    id?: string;
    name?: string;
    accountReference?: string;
  };
  anonymous?: boolean;
  onSuccess?: (response: any) => void;
  onClose?: () => void;
}

// This is a mock implementation to replace the Monnify payment integration
export const payWithMonnify = ({
  amount,
  user,
  contribution,
  anonymous = false,
  onSuccess,
  onClose
}: MonnifyPaymentParams) => {
  console.log('Initializing payment with mock Monnify...', { amount, user, contribution });
  
  // Create a transaction ID
  const transactionId = uuidv4();
  
  // Simulate successful payment automatically (for demo purposes)
  setTimeout(() => {
    console.log('Payment completed successfully');
    
    try {
      // Create a contribution transaction
      if (contribution && contribution.id) {
        createTransaction({
          userId: user.id,
          amount,
          type: 'contribution',
          status: 'completed',
          description: `Contribution to ${contribution.name || 'group'}`,
          referenceId: transactionId,
          accountReference: contribution.accountReference,
          contributionId: contribution.id,
          paymentMethod: 'card',
          isAnonymous: anonymous,
          updatedAt: new Date().toISOString(),
          metaData: {
            contributionName: contribution.name,
            contributorName: anonymous ? 'Anonymous' : user.name,
          },
          userDetails: {
            name: anonymous ? 'Anonymous' : (user.name || ''),
            email: anonymous ? '' : user.email,
          }
        });
      } else {
        // Create a wallet deposit transaction
        createTransaction({
          userId: user.id,
          amount,
          type: 'deposit',
          status: 'completed',
          description: `Wallet funding via card`,
          referenceId: transactionId,
          paymentMethod: 'card',
          updatedAt: new Date().toISOString(),
          metaData: {
            paymentReference: transactionId,
          },
          userDetails: {
            name: user.name || '',
            email: user.email,
          }
        });
      }
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess({
          transactionId,
          amount,
          status: 'SUCCESS',
          paymentReference: transactionId
        });
      }
    } catch (error) {
      console.error('Error processing mock payment:', error);
    }
    
    // Call the close callback if provided
    if (onClose) {
      onClose();
    }
  }, 2000); // Simulate a 2-second payment process
  
  // Return a mock payment reference
  return transactionId;
};
