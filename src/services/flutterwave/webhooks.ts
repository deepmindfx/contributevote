import { toast } from 'sonner';
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserBalance,
  getUserByEmail,
  getContributionByAccountNumber,
  contributeToGroup
} from '../localStorage';
import { verifyTransaction } from './transactions';

// Webhook event types
export type WebhookEvent = 
  | 'charge.completed'
  | 'charge.failed'
  | 'transfer.completed'
  | 'transfer.failed'
  | 'subscription.cancelled'
  | 'refund.completed';

// Webhook payload interface
export interface WebhookData {
  event: WebhookEvent;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    created_at: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string | null;
      created_at: string;
    };
    card?: {
      first_6digits: string;
      last_4digits: string;
      issuer: string;
      country: string;
      type: string;
      expiry: string;
    };
  };
}

/**
 * Verify webhook signature
 * @param payload The webhook payload
 * @param signature The signature from the verif-hash header
 * @returns boolean indicating if signature is valid
 */
export const verifyWebhookSignature = (payload: any, signature: string): boolean => {
  // For Node.js and browser compatibility
  const secretHash = typeof process !== 'undefined' && process.env.FLUTTERWAVE_SECRET_HASH 
    ? process.env.FLUTTERWAVE_SECRET_HASH
    : import.meta?.env?.VITE_FLW_SECRET_HASH || '';
    
  if (!secretHash) {
    console.error('Flutterwave webhook secret hash not configured');
    return false;
  }
  return signature === secretHash;
};

/**
 * Process a successful payment
 * @param data The payment data from the webhook
 */
const processSuccessfulPayment = async (data: WebhookData['data']) => {
  try {
    console.log('=== Starting Payment Processing ===');
    console.log('Payment Data:', JSON.stringify(data, null, 2));

    // Verify the transaction with Flutterwave
    console.log('Verifying transaction with Flutterwave...');
    const verificationResult = await verifyTransaction(data.tx_ref);
    console.log('Webhook Verification Result:', JSON.stringify(verificationResult, null, 2));
    
    if (!verificationResult.success) {
      console.error('Transaction verification failed:', verificationResult);
      return {
        success: false,
        message: 'Transaction verification failed',
        error: verificationResult.message
      };
    }

    // Verify transaction details match
    console.log('Verifying transaction details...');
    console.log('Expected:', {
      status: verificationResult.data.status,
      amount: verificationResult.data.amount,
      currency: verificationResult.data.currency
    });
    console.log('Received:', {
      status: data.status,
      amount: data.amount,
      currency: data.currency
    });

    if (
      verificationResult.data.status !== 'successful' ||
      verificationResult.data.amount !== data.amount ||
      verificationResult.data.currency !== data.currency
    ) {
      console.error('Transaction details mismatch:', {
        expected: verificationResult.data,
        received: data
      });
      return {
        success: false,
        message: 'Transaction details mismatch',
        error: 'Amount or currency mismatch'
      };
    }

    // Find user by email
    console.log('Looking up user by email:', data.customer.email);
    const user = getUserByEmail(data.customer.email);
    console.log('User found:', user ? 'Yes' : 'No', user);

    if (!user) {
      console.error('User not found for email:', data.customer.email);
      return {
        success: false,
        message: 'User not found',
        error: `No user found with email ${data.customer.email}`
      };
    }

    // Check for group contribution
    console.log('=== Checking for Group Contribution ===');
    console.log('Full verification result:', JSON.stringify(verificationResult, null, 2));
    console.log('Meta data:', verificationResult.data.meta);
    
    const accountNumber = verificationResult.data.meta?.account_number || verificationResult.data.meta?.accountNumber;
    console.log('Extracted Account Number:', accountNumber);

    if (accountNumber) {
      console.log('=== Processing Group Contribution ===');
      console.log('Looking up contribution for account:', accountNumber);
      
      const contribution = getContributionByAccountNumber(accountNumber as string);
      console.log('Contribution details:', JSON.stringify(contribution, null, 2));

      if (!contribution) {
        console.error('Contribution not found for account number:', accountNumber);
        return {
          success: false,
          message: 'Contribution not found',
          error: `No contribution found with account number ${accountNumber}`
        };
      }

      // Process the contribution
      console.log('Contributing to group with data:', {
        contributionId: contribution.id,
        amount: data.amount,
        paymentRef: data.tx_ref
      });

      try {
        const contributionResult = contributeToGroup(contribution.id, {
          amount: data.amount,
          anonymous: false,
          paymentMethod: data.payment_type,
          paymentReference: data.tx_ref,
          paymentProvider: 'flutterwave',
          paymentStatus: data.status,
          paymentDetails: {
            transactionId: data.id,
            flwRef: data.flw_ref,
            customerName: data.customer.name,
            customerEmail: data.customer.email,
            customerPhone: data.customer.phone_number,
            paymentType: data.payment_type,
            accountNumber: accountNumber,
            meta: verificationResult.data.meta
          }
        });

        console.log('Contribution result:', JSON.stringify(contributionResult, null, 2));

        // Create transaction record using the new createTransaction function
        console.log('Creating transaction record...');
        const { createTransaction } = await import('../localStorage/transactionOperations');
        
        const transactionResult = await createTransaction({
          userId: user.id,
          contributionId: contribution.id,
          type: 'deposit',
          amount: data.amount,
          status: 'completed',
          description: `Contribution to ${contribution.name}`,
          anonymous: false,
          metaData: {
            paymentMethod: data.payment_type,
            paymentReference: data.tx_ref,
            paymentProvider: 'flutterwave',
            paymentStatus: data.status,
            transactionId: data.id,
            flwRef: data.flw_ref,
            customerName: data.customer.name,
            customerEmail: data.customer.email,
            customerPhone: data.customer.phone_number,
            accountNumber: accountNumber,
            contributionName: contribution.name,
            meta: verificationResult.data.meta
          }
        });

        console.log('Transaction record created:', JSON.stringify(transactionResult, null, 2));

        // Show success notification
        toast.success(`Successfully contributed ${data.amount} ${data.currency} to ${contribution.name}`);

        return {
          success: true,
          message: 'Group contribution processed successfully'
        };
      } catch (error) {
        console.error('Error processing group contribution:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        return {
          success: false,
          message: 'Failed to process group contribution',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      // Regular wallet top-up
      const updateResult = updateUserBalance(user.id, data.amount);
      if (!updateResult.success) {
        console.error('Failed to update user balance:', updateResult);
        return {
          success: false,
          message: 'Failed to update user balance',
          error: updateResult.message
        };
      }

      // Show success notification
      toast.success(`Payment of ${data.amount} ${data.currency} received successfully`);

      return {
        success: true,
        message: 'Payment processed successfully'
      };
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      message: 'Error processing payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Handle incoming webhook from Flutterwave
 * @param webhookData The webhook payload from Flutterwave
 * @param signature The signature from the verif-hash header
 */
export const handleWebhook = async (webhookData: WebhookData, signature: string) => {
  try {
    console.log('Received webhook:', webhookData);

    // Verify webhook signature
    if (!verifyWebhookSignature(webhookData, signature)) {
      console.error('Invalid webhook signature');
      return {
        success: false,
        message: 'Invalid webhook signature'
      };
    }

    // Handle different event types
    switch (webhookData.event) {
      case 'charge.completed':
        return await processSuccessfulPayment(webhookData.data);
      
      case 'charge.failed':
        console.log('Payment failed:', webhookData.data);
        toast.error('Payment failed. Please try again.');
        return {
          success: true,
          message: 'Payment failure logged'
        };

      case 'transfer.completed':
        console.log('Transfer completed:', webhookData.data);
        return {
          success: true,
          message: 'Transfer completed'
        };

      case 'transfer.failed':
        console.log('Transfer failed:', webhookData.data);
        return {
          success: true,
          message: 'Transfer failure logged'
        };

      case 'subscription.cancelled':
        console.log('Subscription cancelled:', webhookData.data);
        return {
          success: true,
          message: 'Subscription cancellation logged'
        };

      case 'refund.completed':
        console.log('Refund completed:', webhookData.data);
        return {
          success: true,
          message: 'Refund completed'
        };

      default:
        console.log('Unhandled webhook event:', webhookData.event);
        return {
          success: true,
          message: 'Unhandled event type'
        };
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    return {
      success: false,
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 