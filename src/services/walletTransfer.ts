
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "./monnifyApi";
import { 
  User, 
  updateUser, 
  getCurrentUser, 
  addTransaction,
  getTransactions
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
    
    console.log("Transfer data being sent:", transferData);
    
    // Initiate the async transfer
    const result = await monnifyApi.initiateAsyncTransfer(transferData);
    
    console.log("Transfer API response:", result);
    
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
      message: "An error occurred while processing your transfer. Please try again later."
    };
  }
};

/**
 * Check the status of a transfer and update the transaction record
 * @param reference Transfer reference
 * @returns Transfer status
 */
export const checkTransferStatus = async (reference: string): Promise<TransferResponse> => {
  try {
    console.log("Checking transfer status for:", reference);
    
    // Make a real API call to check transfer status
    const result = await monnifyApi.checkTransferStatus(reference);
    
    if (!result.requestSuccessful) {
      console.log("Error checking transfer status:", result);
      return {
        success: false,
        message: result.responseMessage || "Failed to check transfer status"
      };
    }
    
    const responseBody = result.responseBody;
    
    // Update transaction status if necessary
    const allTransactions = getTransactions();
    const transaction = allTransactions.find(t => 
      t.metaData && t.metaData.transferReference === reference
    );
    
    if (transaction) {
      // Update the status based on the API response
      const newStatus = responseBody.status === "SUCCESS" ? "completed" : 
                        responseBody.status === "FAILED" ? "failed" : "pending";
      
      if (transaction.status !== newStatus) {
        transaction.status = newStatus;
        localStorage.setItem('transactions', JSON.stringify(allTransactions));
        
        if (newStatus === "completed") {
          toast.success("Transfer has been completed");
        } else if (newStatus === "failed") {
          toast.error("Transfer has failed");
          
          // Refund the money if the transfer failed
          const currentUser = getCurrentUser();
          if (currentUser && newStatus === "failed") {
            updateUser({
              ...currentUser,
              walletBalance: (currentUser.walletBalance || 0) + transaction.amount
            });
          }
        }
      }
    }
    
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

/**
 * Poll the transfer status until it's no longer pending or until timeout
 * @param reference Transfer reference
 * @param maxAttempts Maximum number of polling attempts
 * @param interval Interval between attempts in milliseconds
 * @returns Final transfer status
 */
export const pollTransferStatus = async (
  reference: string, 
  maxAttempts = 10, 
  interval = 2000
): Promise<TransferResponse> => {
  let attempts = 0;
  
  const poll = async (): Promise<TransferResponse> => {
    attempts++;
    
    const statusResponse = await checkTransferStatus(reference);
    
    // If not successful response, return immediately
    if (!statusResponse.success) {
      return statusResponse;
    }
    
    // If status is SUCCESS or FAILED, return immediately
    if (statusResponse.status === "SUCCESS" || statusResponse.status === "FAILED") {
      return statusResponse;
    }
    
    // If reached max attempts, return current status
    if (attempts >= maxAttempts) {
      return {
        ...statusResponse,
        message: "Transfer is still processing. Please check again later."
      };
    }
    
    // Wait for the interval and try again
    await new Promise(resolve => setTimeout(resolve, interval));
    return poll();
  };
  
  return poll();
};
