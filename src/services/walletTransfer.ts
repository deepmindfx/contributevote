
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "./monnifyApi";
import { 
  User, 
  updateUser, 
  getCurrentUser, 
  addTransaction 
} from "./localStorage";

/**
 * Interface for bank transfer request
 */
export interface BankTransferRequest {
  amount: number;
  destinationBankCode: string;
  destinationAccountNumber: string;
  narration: string;
  recipientName?: string;
}

/**
 * Interface for transfer response
 */
export interface TransferResponse {
  success: boolean;
  message: string;
  reference?: string;
  status?: string;
  amount?: number;
  fee?: number;
  destinationBankName?: string;
  destinationAccountName?: string;
  destinationAccountNumber?: string;
  dateCreated?: string;
}

/**
 * Send money to a bank account using async transfer
 * @param request Transfer request data
 * @returns Transfer response
 */
export const sendMoneyToBank = async (request: BankTransferRequest): Promise<TransferResponse> => {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return {
        success: false,
        message: "You need to be logged in to make transfers"
      };
    }
    
    // Check if user has sufficient balance
    if (!currentUser.walletBalance || currentUser.walletBalance < request.amount) {
      return {
        success: false,
        message: "Insufficient funds in your wallet"
      };
    }
    
    // Get user's reserved account for the source account number
    if (!currentUser.reservedAccount?.accountNumber) {
      return {
        success: false,
        message: "You need to set up a virtual account before making transfers"
      };
    }
    
    // Generate a unique reference for this transfer
    const reference = `TRF_${currentUser.id}_${Date.now()}`;
    
    // Prepare transfer data
    const transferData = {
      amount: request.amount,
      reference,
      narration: request.narration || "Wallet Transfer",
      destinationBankCode: request.destinationBankCode,
      destinationAccountNumber: request.destinationAccountNumber,
      currency: "NGN",
      sourceAccountNumber: currentUser.reservedAccount.accountNumber,
      async: true
    };
    
    // Initiate the async transfer
    const result = await monnifyApi.initiateAsyncTransfer(transferData);
    
    if (!result.requestSuccessful) {
      return {
        success: false,
        message: result.responseMessage || "Failed to process transfer"
      };
    }
    
    const responseBody = result.responseBody;
    
    // Record the transaction
    const transactionId = uuidv4();
    addTransaction({
      id: transactionId,
      userId: currentUser.id,
      type: "withdrawal",
      amount: request.amount,
      contributionId: "",
      description: `Bank transfer to ${responseBody.destinationBankName || 'bank'} - ${request.narration || 'Transfer'}`,
      status: responseBody.status === "SUCCESS" ? "completed" : "pending",
      createdAt: new Date().toISOString(),
      metaData: {
        transferReference: reference,
        bankName: responseBody.destinationBankName || request.destinationBankCode,
        accountNumber: request.destinationAccountNumber,
        recipientName: responseBody.destinationAccountName || request.recipientName || "",
        fee: responseBody.totalFee || 0
      }
    });
    
    // Update user's wallet balance
    // Only deduct immediately if transfer is successful; for PENDING, we'll wait for webhook in production
    // For demo purposes, we'll deduct for both success and pending
    updateUser({
      ...currentUser,
      walletBalance: currentUser.walletBalance - request.amount
    });
    
    // Return response
    return {
      success: true,
      message: responseBody.status === "SUCCESS" 
        ? "Transfer completed successfully" 
        : "Transfer initiated successfully and is being processed",
      reference,
      status: responseBody.status,
      amount: responseBody.amount,
      fee: responseBody.totalFee,
      destinationBankName: responseBody.destinationBankName,
      destinationAccountName: responseBody.destinationAccountName,
      destinationAccountNumber: responseBody.destinationAccountNumber,
      dateCreated: responseBody.dateCreated
    };
  } catch (error) {
    console.error("Error sending money to bank:", error);
    return {
      success: false,
      message: "An error occurred while processing your transfer"
    };
  }
};

/**
 * Check the status of a transfer
 * @param reference Transfer reference
 * @returns Transfer status
 */
export const checkTransferStatus = async (reference: string): Promise<TransferResponse> => {
  try {
    const result = await monnifyApi.checkTransferStatus(reference);
    
    if (!result.requestSuccessful) {
      return {
        success: false,
        message: result.message || "Failed to check transfer status"
      };
    }
    
    const responseBody = result.responseBody;
    
    // Update transaction status if necessary
    // In a real app, this would be handled by webhooks
    // For demo purposes, we'll do it here
    
    return {
      success: true,
      message: "Transfer status retrieved successfully",
      status: responseBody.status,
      amount: responseBody.amount,
      fee: responseBody.totalFee,
      destinationBankName: responseBody.destinationBankName,
      destinationAccountName: responseBody.destinationAccountName,
      destinationAccountNumber: responseBody.destinationAccountNumber,
      dateCreated: responseBody.dateCreated
    };
  } catch (error) {
    console.error("Error checking transfer status:", error);
    return {
      success: false,
      message: "An error occurred while checking your transfer status"
    };
  }
};
