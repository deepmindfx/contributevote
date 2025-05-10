import { toast } from 'sonner';
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserBalance,
  getUserByEmail
} from '../localStorage';
import { verifyTransaction } from './virtualAccounts';

interface WebhookData {
  event: string;
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
    };
    narration?: string;
    account_id?: number;
    account_number?: string;
  };
  'event.type': string;
}

/**
 * Handle incoming webhook from Flutterwave
 * @param webhookData The webhook payload from Flutterwave
 */
export const handleWebhook = async (webhookData: WebhookData) => {
  try {
    console.log('Received webhook:', webhookData);

    // Only process successful bank transfers
    if (
      webhookData.event !== 'charge.completed' ||
      webhookData['event.type'] !== 'BANK_TRANSFER_TRANSACTION' ||
      webhookData.data.status !== 'successful' ||
      webhookData.data.payment_type !== 'bank_transfer'
    ) {
      console.log('Ignoring non-relevant webhook event');
      return { success: true, message: 'Event ignored' };
    }

    const { data } = webhookData;
    
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
    
    // Find user by email from the webhook data
    const user = getUserByEmail(data.customer.email);
    if (!user) {
      console.error('User not found for email:', data.customer.email);
      return {
        success: false,
        message: 'User not found',
        error: `No user found with email ${data.customer.email}`
      };
    }

    // Check if transaction already exists
    const existingTransaction = user.transactions?.find(
      t => t.referenceId === data.flw_ref
    );

    if (existingTransaction) {
      console.log('Transaction already processed:', data.flw_ref);
      return {
        success: true,
        message: 'Transaction already processed',
        data: existingTransaction
      };
    }

    // Create new transaction record
    const newTransaction = {
      userId: user.id,
      contributionId: '', // Empty for direct wallet funding
      type: 'deposit',
      amount: data.amount,
      status: 'completed',
      description: data.narration || 'Bank transfer to virtual account',
      referenceId: data.flw_ref,
      paymentMethod: 'bank_transfer',
      updatedAt: new Date().toISOString(),
      metaData: {
        senderName: data.customer.name,
        bankName: 'Bank Transfer',
        narration: data.narration || '',
        transactionReference: data.tx_ref,
        paymentReference: data.flw_ref,
        accountNumber: data.account_number || '',
        accountId: data.account_id?.toString() || ''
      }
    };

    // Add transaction to history
    addTransaction(newTransaction);

    // Update user's wallet balance
    const newBalance = (user.walletBalance || 0) + data.amount;
    updateUserBalance(user.id, newBalance);

    console.log('Successfully processed webhook:', {
      userId: user.id,
      transactionId: data.flw_ref,
      amount: data.amount,
      newBalance,
      email: data.customer.email
    });

    // Send notification to user
    toast.success(`Successfully credited ${data.amount} to your wallet`);
    
    return {
      success: true,
      message: 'Webhook processed successfully',
      data: {
        userId: user.id,
        amount: data.amount,
        newBalance
      }
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      success: false,
      message: 'Error processing payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 