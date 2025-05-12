
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from '@/services/localStorage/types';
import { toast } from 'sonner';
import { createTransaction } from '@/services/localStorage/transactionOperations';
import { updateUserBalance } from '@/services/localStorage/utilityOperations';

// Interface for transfer data
interface TransferData {
  amount: number;
  recipientAccount: string;
  recipientName: string;
  bankName: string;
  narration?: string;
  userId: string;
  senderName: string;
}

/**
 * Save a transfer transaction to localStorage
 */
export const saveTransferTransaction = (transferData: TransferData): string => {
  try {
    // Generate a unique reference for the transaction
    const reference = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create transaction object with required structure
    const transaction: any = {
      reference,
      amount: transferData.amount,
      fee: 20, // Standard fee for transfers
      status: 'completed',
      recipientName: transferData.recipientName,
      recipientAccount: transferData.recipientAccount,
      bankName: transferData.bankName,
      narration: transferData.narration || 'Transfer funds',
      type: 'transfer',
      userId: transferData.userId,
      contributionId: '', // Empty for wallet transfers
      description: `Transfer to ${transferData.recipientName} (${transferData.bankName})`,
      paymentMethod: 'wallet',
      updatedAt: new Date().toISOString(),
      metaData: {
        senderName: transferData.senderName,
        bankName: transferData.bankName,
        narration: transferData.narration || 'Transfer funds',
        transactionReference: reference,
        paymentReference: reference
      }
    };
    
    console.log('Saving transfer transaction:', transaction);
    
    // Save the transaction using the createTransaction function
    createTransaction(transaction);
    
    // Update user's wallet balance (deduct transfer amount + fee)
    updateUserBalance(transferData.userId, -transferData.amount - 20);
    
    return reference;
  } catch (error) {
    console.error('Error saving transfer transaction:', error);
    toast.error('Failed to save transaction record');
    return '';
  }
};

/**
 * Process a bank transfer
 */
export const processBankTransfer = async (transferData: TransferData): Promise<boolean> => {
  try {
    // In a real application, this would call an API to process the transfer
    // For now, we'll just simulate a successful transfer and save the transaction
    
    // Save the transaction to localStorage
    const reference = saveTransferTransaction(transferData);
    
    if (!reference) {
      return false;
    }
    
    // Simulate API call success
    return true;
  } catch (error) {
    console.error('Error processing bank transfer:', error);
    return false;
  }
};
