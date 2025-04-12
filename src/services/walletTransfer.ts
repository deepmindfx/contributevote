
import { v4 as uuidv4 } from 'uuid';
import { initiateTransfer, TransferData, TransferResponse } from './monnifyApi';
import { 
  updateUserBalance, 
  addTransaction, 
  getCurrentUser,
  getBankList,
  getContributions
} from './localStorage';

/**
 * Send money to a bank account
 * @param amount Amount to send
 * @param narration Transaction narration/description
 * @param bankCode Destination bank code
 * @param accountNumber Destination account number
 * @param useAsync Whether to use asynchronous processing
 * @returns Response with transfer details
 */
export const sendMoneyToBank = async (
  amount: number,
  narration: string,
  bankCode: string,
  accountNumber: string,
  useAsync: boolean = false
): Promise<TransferResponse> => {
  try {
    const currentUser = getCurrentUser();
    
    // Check if user has a reserved account
    if (!currentUser?.reservedAccount?.accountNumber) {
      return {
        success: false,
        message: "You don't have a virtual account set up. Please set up a virtual account first."
      };
    }
    
    // Check if user has sufficient balance
    if (currentUser.walletBalance < amount) {
      return {
        success: false,
        message: "Insufficient funds in your wallet"
      };
    }
    
    // Create a unique reference for the transaction
    const reference = `transfer-${uuidv4()}`;
    
    // Prepare transfer data
    const transferData: TransferData = {
      amount,
      reference,
      narration,
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
      currency: "NGN",
      sourceAccountNumber: currentUser.reservedAccount.accountNumber
    };
    
    // Initiate the transfer
    const result = await initiateTransfer(transferData, useAsync);
    
    if (result.requestSuccessful) {
      // Deduct the amount from user's wallet balance
      updateUserBalance(currentUser.id, -amount);
      
      // Add transaction record
      const bankList = getBankList();
      const bank = bankList.find(bank => bank.code === bankCode);
      
      addTransaction({
        userId: currentUser.id,
        type: 'withdrawal',
        amount,
        status: useAsync ? 'pending' : 'completed',
        description: `Transfer to ${accountNumber} - ${narration}`,
        createdAt: new Date().toISOString(),
        reference,
        senderName: currentUser.name,
        receiverName: result.responseBody?.destinationAccountName || 'Bank Account',
        receiverBank: result.responseBody?.destinationBankName || bank?.name || 'Bank',
        receiverAccount: accountNumber,
        fee: result.responseBody?.totalFee || 0
      });
      
      return {
        success: true,
        message: useAsync ? 
          "Transfer initiated successfully and is being processed" : 
          "Transfer completed successfully",
        ...result
      };
    }
    
    return {
      success: false,
      message: result.responseMessage || "Transfer failed",
      ...result
    };
  } catch (error) {
    console.error("Error sending money:", error);
    return {
      success: false,
      message: "An error occurred while processing your transfer"
    };
  }
};

/**
 * Get a list of supported banks
 * @returns Array of bank objects with code and name
 */
export const getSupportedBanks = (): { code: string; name: string }[] => {
  return getBankList();
};
