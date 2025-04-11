
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "./monnifyApi";
import { toast } from "sonner";
import { 
  User,
  addTransaction,
  updateUser,
  getCurrentUser,
  getContributionById
} from "./localStorage";

/**
 * Interface for bank data
 */
export interface Bank {
  name: string;
  code: string;
  ussdShortCode?: string;
  sortCode?: string;
  bankAccentHex?: string;
  type?: string;
}

/**
 * Transfer money from user's wallet to a bank account
 */
export const transferToBank = async (
  userId: string,
  amount: number,
  bankCode: string,
  accountNumber: string,
  narration: string,
  pin: string
): Promise<boolean> => {
  try {
    // Get current user
    const currentUser = getCurrentUser();
    
    // Validate user
    if (currentUser.id !== userId) {
      toast.error("Unauthorized access");
      return false;
    }
    
    // Validate PIN
    if (currentUser.pin !== pin) {
      toast.error("Invalid transaction PIN");
      return false;
    }
    
    // Check if user has enough balance
    if (currentUser.walletBalance < amount) {
      toast.error("Insufficient funds in your wallet");
      return false;
    }
    
    // Check if user has a reserved account
    if (!currentUser.reservedAccount || !currentUser.reservedAccount.accountNumber) {
      toast.error("No virtual account found. Please create a virtual account first.");
      return false;
    }
    
    // Generate a unique reference
    const reference = `TR_${userId}_${Date.now()}`;
    
    // Prepare transfer data
    const transferData = {
      amount,
      reference,
      narration,
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
      currency: "NGN",
      sourceAccountNumber: currentUser.reservedAccount.accountNumber,
      async: false
    };
    
    // Initiate transfer
    const result = await monnifyApi.initiateTransfer(transferData);
    
    if (!result.success || !result.requestSuccessful) {
      toast.error(result.message || "Failed to initiate transfer");
      return false;
    }
    
    const responseBody = result.responseBody;
    
    // Add transaction record
    const transaction = {
      id: uuidv4(),
      userId,
      type: "withdrawal" as "deposit" | "withdrawal" | "transfer" | "vote",
      amount,
      contributionId: "",
      description: narration || "Transfer to bank account",
      status: responseBody.status === "SUCCESS" ? "completed" as "completed" | "pending" | "failed" : "pending" as "completed" | "pending" | "failed",
      createdAt: new Date().toISOString(),
      metaData: {
        destinationBank: responseBody.destinationBankName,
        destinationAccount: responseBody.destinationAccountNumber,
        destinationAccountName: responseBody.destinationAccountName,
        reference,
        fee: responseBody.totalFee || 0
      }
    };
    
    addTransaction(transaction);
    
    // Update user's wallet balance if payment is successful
    if (responseBody.status === "SUCCESS") {
      const totalDeduction = amount + (responseBody.totalFee || 0);
      const updatedBalance = currentUser.walletBalance - totalDeduction;
      
      updateUser({
        ...currentUser,
        walletBalance: updatedBalance
      });
      
      toast.success(`Successfully transferred ₦${amount.toLocaleString()} to ${responseBody.destinationAccountName}`);
    } else {
      toast.info("Transfer initiated and pending. Your balance will be updated once completed.");
    }
    
    return true;
  } catch (error) {
    console.error("Error transferring to bank:", error);
    toast.error("Failed to transfer funds. Please try again.");
    return false;
  }
};

/**
 * Get list of banks
 */
export const getBanksList = async (): Promise<Bank[]> => {
  try {
    const result = await monnifyApi.getBanks();
    
    if (!result.success) {
      toast.error(result.message || "Failed to fetch banks");
      return [];
    }
    
    return result.banks;
  } catch (error) {
    console.error("Error getting banks list:", error);
    toast.error("Failed to load banks. Please try again.");
    return [];
  }
};

/**
 * Verify a bank account
 */
export const verifyAccount = async (accountNumber: string, bankCode: string): Promise<{
  success: boolean;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  message?: string;
}> => {
  try {
    const result = await monnifyApi.verifyBankAccount(accountNumber, bankCode);
    
    if (!result.success) {
      toast.error(result.message || "Failed to verify account");
      return { success: false, message: result.message };
    }
    
    return result;
  } catch (error) {
    console.error("Error verifying account:", error);
    toast.error("Failed to verify account. Please try again.");
    return { success: false, message: "Failed to verify account" };
  }
};

/**
 * Transfer money to another user's wallet
 */
export const transferToUser = async (
  senderId: string,
  receiverAccountNumber: string,
  amount: number,
  narration: string,
  pin: string
): Promise<boolean> => {
  try {
    // Implementation for user-to-user transfers
    // This would be implemented in a real application that has user accounts
    toast.error("User-to-user transfers not implemented in this demo");
    return false;
  } catch (error) {
    console.error("Error transferring to user:", error);
    toast.error("Failed to transfer funds. Please try again.");
    return false;
  }
};
