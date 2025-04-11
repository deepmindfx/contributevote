
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "../monnifyApi";
import { 
  updateUser, 
  getCurrentUser, 
  getTransactions, 
  updateUserById, 
  addTransaction
} from "../localStorage";
import { ReservedAccountData } from "./types";

/**
 * Creates a reserved account for a user
 * @param userId The user ID
 * @param idType The type of ID (BVN or NIN)
 * @param idNumber The ID number provided by the user
 * @returns Reserved account details
 */
export const createUserReservedAccount = async (
  userId: string, 
  idType?: string, 
  idNumber?: string
): Promise<ReservedAccountData | null> => {
  try {
    // Get current user data
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return null;
    }
    
    // Check if user already has a reserved account
    if (user.reservedAccount) {
      toast.info("User already has a reserved account");
      return user.reservedAccount;
    }
    
    // Validate ID information
    if (!idType || !idNumber) {
      toast.error("BVN or NIN is required to create a virtual account");
      return null;
    }
    
    // Create a unique account reference
    const accountReference = `COLL_${userId}_${Date.now()}`;
    
    // Create the API request object based on ID type
    const requestBody: any = {
      accountReference,
      accountName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      currencyCode: "NGN",
      contractCode: "465595618981", // Updated with real contract code
      getAllAvailableBanks: true
    };
    
    // Add either BVN or NIN based on the user's selection
    if (idType === "bvn") {
      requestBody.bvn = idNumber;
    } else if (idType === "nin") {
      requestBody.nin = idNumber;
    }
    
    // Create a reserved account using the provided ID
    const result = await monnifyApi.createReservedAccount(requestBody);
    
    if (!result || !result.responseBody) {
      toast.error("Failed to create reserved account");
      return null;
    }
    
    // Extract relevant account data
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].accountNumber : "",
      bankName: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].bankName : "",
      bankCode: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].bankCode : "",
      reservationReference: responseBody.reservationReference,
      status: responseBody.status,
      createdOn: responseBody.createdOn,
      accounts: responseBody.accounts?.map(acc => ({
        bankCode: acc.bankCode,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber
      }))
    };
    
    // Update user with reserved account data
    if (userId === currentUser.id) {
      // Update current user
      updateUser({ 
        ...currentUser, 
        reservedAccount 
      });
    } else {
      // Update other user (admin action)
      updateUserById(userId, { reservedAccount });
    }
    
    toast.success("Reserved account created successfully");
    return reservedAccount;
  } catch (error) {
    console.error("Error creating reserved account:", error);
    toast.error("Failed to create reserved account. Please try again.");
    return null;
  }
};

/**
 * Gets the reserved account for a user
 * @param userId The user ID
 * @returns Reserved account details
 */
export const getUserReservedAccount = async (userId: string): Promise<ReservedAccountData | null> => {
  try {
    // Get current user data
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return null;
    }
    
    // Check if user has a reserved account
    if (!user.reservedAccount || !user.reservedAccount.accountReference) {
      toast.info("User doesn't have a reserved account");
      return null;
    }
    
    // Fetch the latest details from Monnify
    const result = await monnifyApi.getReservedAccountDetails(user.reservedAccount.accountReference);
    
    if (!result || !result.responseBody) {
      toast.error("Failed to get reserved account details");
      return user.reservedAccount; // Return cached version
    }
    
    // Extract relevant account data
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].accountNumber : "",
      bankName: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].bankName : "",
      bankCode: responseBody.accounts && responseBody.accounts.length > 0 ? responseBody.accounts[0].bankCode : "",
      reservationReference: responseBody.reservationReference,
      status: responseBody.status,
      createdOn: responseBody.createdOn,
      accounts: responseBody.accounts?.map(acc => ({
        bankCode: acc.bankCode,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber
      }))
    };
    
    // Update user with the latest reserved account data
    if (userId === currentUser.id) {
      // Update current user
      updateUser({ 
        ...currentUser, 
        reservedAccount 
      });
    } else {
      // Update other user (admin action)
      updateUserById(userId, { reservedAccount });
    }
    
    return reservedAccount;
  } catch (error) {
    console.error("Error getting reserved account:", error);
    toast.error("Failed to get reserved account details. Please try again.");
    
    // Get current user data again to return cached version
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    return user?.reservedAccount || null;
  }
};

/**
 * Fetches transactions for a reserved account
 * @param accountReference The account reference
 * @returns Array of transactions
 */
export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    const result = await monnifyApi.getReservedAccountTransactions(accountReference);
    
    if (!result || !result.responseBody) {
      toast.error("Failed to fetch transactions");
      return null;
    }
    
    const responseBody = result.responseBody;
    
    // Process the transactions and add them to the local storage
    if (responseBody.content && Array.isArray(responseBody.content)) {
      for (const transaction of responseBody.content) {
        await processReservedAccountTransaction({
          transactionReference: transaction.transactionReference,
          paymentReference: transaction.paymentReference,
          amountPaid: transaction.amount,
          totalPayable: transaction.amount,
          settlementAmount: transaction.amount,
          paidOn: transaction.paidOn,
          paymentStatus: transaction.paymentStatus,
          paymentDescription: `Bank transfer from ${transaction.destinationBankName || 'bank'}`,
          metaData: {},
          accountDetails: {
            accountName: transaction.destinationAccountName || '',
            accountNumber: transaction.destinationAccountNumber || '',
            bankCode: '',
            bankName: transaction.destinationBankName || ''
          }
        });
      }
    }
    
    return responseBody;
  } catch (error) {
    console.error("Error fetching reserved account transactions:", error);
    toast.error("Failed to fetch transactions. Please try again.");
    return null;
  }
};

/**
 * Processes a transaction from a reserved account
 * This would typically be called by a webhook handler in a real app
 * @param data Transaction data from Monnify
 */
export const processReservedAccountTransaction = async (data: {
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  totalPayable: number;
  settlementAmount: number;
  paidOn: string;
  paymentStatus: string;
  paymentDescription: string;
  metaData?: {
    contributionId?: string;
    userId?: string;
  };
  accountDetails: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
  };
}) => {
  try {
    const {
      transactionReference,
      paymentReference,
      amountPaid,
      totalPayable,
      settlementAmount,
      paidOn,
      paymentStatus,
      paymentDescription,
      metaData,
      accountDetails
    } = data;
    
    // Get current user (who has the reserved account)
    const currentUser = getCurrentUser();
    
    // In a real app, we would use the accountReference to find the user
    // but for this demo, we'll use the current user
    const userId = metaData?.userId || currentUser.id;
    
    // Check if transaction already exists to prevent duplicates
    const existingTransactions = getTransactions();
    const existingTransaction = existingTransactions.find(t => 
      t.id === transactionReference || 
      (t.metaData && t.metaData.paymentReference === paymentReference)
    );
    
    if (existingTransaction) {
      // Transaction already processed
      return existingTransaction;
    }
    
    // Add transaction record
    const transaction = {
      id: transactionReference || uuidv4(),
      userId,
      type: "deposit" as "deposit" | "withdrawal" | "transfer" | "vote",
      amount: amountPaid,
      contributionId: metaData?.contributionId || "",
      description: paymentDescription || "Bank transfer to virtual account",
      status: paymentStatus === "PAID" ? "completed" as "completed" | "pending" | "failed" : "pending" as "completed" | "pending" | "failed",
      createdAt: new Date(paidOn || Date.now()).toISOString(),
      metaData: {
        paymentReference,
        bankName: accountDetails?.bankName || '',
        accountNumber: accountDetails?.accountNumber || ''
      }
    };
    
    addTransaction(transaction);
    
    // Update user's wallet balance if payment is successful
    if (paymentStatus === "PAID") {
      if (userId === currentUser.id) {
        const updatedBalance = (currentUser.walletBalance || 0) + amountPaid;
        updateUser({
          ...currentUser,
          walletBalance: updatedBalance
        });
        toast.success(`Wallet funded with ₦${amountPaid.toLocaleString()}`);
      } else {
        // Update another user (admin action)
        updateUserById(userId, {
          walletBalance: (currentUser.walletBalance || 0) + amountPaid
        });
      }
    }
    
    console.log("Transaction processed:", transaction);
    return transaction;
  } catch (error) {
    console.error("Error processing transaction:", error);
    toast.error("Failed to process transaction. Please try again.");
    return null;
  }
};
