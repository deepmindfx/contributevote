import { toast } from 'sonner';
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserBalance,
  getUserByEmail
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
  const secretHash = import.meta.env.VITE_FLW_SECRET_HASH;
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
    // Verify the transaction with Flutterwave
    const verificationResult = await verifyTransaction(data.tx_ref);
    
    if (!verificationResult.success) {
      console.error('Transaction verification failed:', verificationResult);
      return {
        success: false,
        message: 'Transaction verification failed',
        error: verificationResult.message
      };
    }

    // Verify transaction details match
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
    const user = getUserByEmail(data.customer.email);
    if (!user) {
      console.error('User not found for email:', data.customer.email);
      return {
        success: false,
        message: 'User not found',
        error: `No user found with email ${data.customer.email}`
      };
    }

    // Update user's balance
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