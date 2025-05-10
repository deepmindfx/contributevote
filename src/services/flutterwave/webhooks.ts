import { toast } from 'sonner';
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserBalance 
} from '../localStorage';

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
      return;
    }

    const { data } = webhookData;
    const currentUser = getCurrentUser();

    // Check if transaction already exists
    const existingTransaction = currentUser.transactions?.find(
      t => t.referenceId === data.flw_ref
    );

    if (existingTransaction) {
      console.log('Transaction already processed:', data.flw_ref);
      return;
    }

    // Create new transaction record
    const newTransaction = {
      userId: currentUser.id,
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
      }
    };

    // Add transaction to history
    addTransaction(newTransaction);

    // Update user's wallet balance
    const newBalance = currentUser.walletBalance + data.amount;
    updateUserBalance(currentUser.id, newBalance);

    console.log('Successfully processed webhook:', {
      transactionId: data.flw_ref,
      amount: data.amount,
      newBalance
    });

    toast.success(`Successfully credited ${data.amount} to your wallet`);
  } catch (error) {
    console.error('Error processing webhook:', error);
    toast.error('Error processing payment. Please contact support.');
  }
}; 