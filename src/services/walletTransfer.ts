
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "./monnifyApi";
import { 
  User, 
  updateUser, 
  getCurrentUser, 
  addTransaction,
  updateTransaction
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
      // Handle specific error codes
      if (result.responseCode === "D06") {
        return {
          success: false,
          message: "API configuration error: This is a demo environment. In production, your account would need proper setup by Monnify."
        };
      }
      
      // For demo purposes, simulate a successful transfer if we're getting API errors
      // This allows testing the flow without actual API integration
      if (process.env.NODE_ENV !== "production") {
        console.log("DEMO MODE: Simulating successful transfer response");
        
        // Create a transaction record for the demo transfer
        const transactionId = uuidv4();
        addTransaction({
          id: transactionId,
          userId: currentUser.id,
          type: "withdrawal",
          amount: request.amount,
          contributionId: "",
          description: `Bank transfer to ${request.destinationBankCode} - ${request.narration || 'Transfer'} (Demo)`,
          status: "completed",
          createdAt: new Date().toISOString(),
          metaData: {
            transferReference: reference,
            bankName: request.destinationBankCode,
            accountNumber: request.destinationAccountNumber,
            recipientName: request.recipientName || "",
            fee: 25 // Typical fee
          }
        });
        
        // Update user's wallet balance
        updateUser({
          ...currentUser,
          walletBalance: currentUser.walletBalance - request.amount
        });
        
        return {
          success: true,
          message: "Demo transfer completed successfully",
          reference,
          status: "SUCCESS",
          amount: request.amount,
          fee: 25,
          destinationBankName: request.destinationBankCode, 
          destinationAccountNumber: request.destinationAccountNumber,
          destinationAccountName: request.recipientName || "Demo Recipient",
          dateCreated: new Date().toISOString()
        };
      }
      
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
    // For demo environment, simulate a successful status check 
    // after a short delay to mimic the API checking process
    if (process.env.NODE_ENV !== "production") {
      console.log("DEMO MODE: Simulating transfer status check for:", reference);
      
      // Find the transaction with this reference in metaData
      const currentUser = getCurrentUser();
      const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const transaction = allTransactions.find(t => 
        t.metaData && t.metaData.transferReference === reference
      );
      
      if (transaction) {
        // If it's been more than 10 seconds since creation, update to completed
        const createdAt = new Date(transaction.createdAt).getTime();
        const now = Date.now();
        const timeElapsed = now - createdAt;
        
        if (timeElapsed > 10000 && transaction.status === "pending") {
          // Update the transaction to completed
          transaction.status = "completed";
          localStorage.setItem('transactions', JSON.stringify(allTransactions));
          
          toast.success("Transfer has been completed");
          
          return {
            success: true,
            message: "Demo transfer completed successfully",
            reference,
            status: "SUCCESS",
            amount: transaction.amount,
            fee: transaction.metaData?.fee || 25,
            destinationBankName: transaction.metaData?.bankName || "Demo Bank",
            destinationAccountName: transaction.metaData?.recipientName || "Demo Recipient",
            destinationAccountNumber: transaction.metaData?.accountNumber || "0000000000",
            dateCreated: transaction.createdAt
          };
        }
        
        return {
          success: true,
          message: "Transfer is still being processed",
          reference,
          status: transaction.status === "completed" ? "SUCCESS" : "PENDING",
          amount: transaction.amount,
          fee: transaction.metaData?.fee || 0,
          destinationBankName: transaction.metaData?.bankName || "Demo Bank",
          destinationAccountName: transaction.metaData?.recipientName || "Demo Recipient",
          destinationAccountNumber: transaction.metaData?.accountNumber || "0000000000",
          dateCreated: transaction.createdAt
        };
      }
      
      return {
        success: false,
        message: "Transfer reference not found"
      };
    }
    
    // In production, make a real API call
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
    const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
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

