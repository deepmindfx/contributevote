
// Wallet Integration Service
// This file coordinates interactions with external payment services
import { toast } from "sonner";
import * as monnifyApi from "./monnifyApi";
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserById,
  updateUser,
  updateUserWalletById,
} from "./localStorage";
import { ReservedAccountData, InvoiceData } from "./wallet/types";

// Interface for payment invoice creation
export interface PaymentInvoiceParams {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
  contributionId?: string;
}

/**
 * Creates a reserved account for a user
 */
export const createUserReservedAccount = async (
  userId: string, 
  idType?: string, 
  idNumber?: string
): Promise<ReservedAccountData | null> => {
  try {
    // Get current user data
    const currentUser = getCurrentUser();
    const user = currentUser.id === userId ? currentUser : null;
    
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
    
    // Create the API request object
    const requestBody: any = {
      accountReference,
      accountName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      currencyCode: "NGN",
      contractCode: "465595618981",
      getAllAvailableBanks: true
    };
    
    if (idType === "bvn") {
      requestBody.bvn = idNumber;
    } else if (idType === "nin") {
      requestBody.nin = idNumber;
    }
    
    const result = await monnifyApi.createReservedAccount(requestBody);
    
    if (!result || !result.responseBody) {
      if (result && !result.success) {
        toast.error(result.message || "Failed to create reserved account");
      } else {
        toast.error("Failed to create reserved account");
      }
      return null;
    }
    
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts?.[0]?.accountNumber || "",
      bankName: responseBody.accounts?.[0]?.bankName || "",
      bankCode: responseBody.accounts?.[0]?.bankCode || "",
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
      updateUser({ ...currentUser, reservedAccount });
    } else {
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
 * Retrieves user's reserved account details
 */
export const getUserReservedAccount = async (userId: string): Promise<ReservedAccountData | null> => {
  try {
    const currentUser = getCurrentUser();
    const user = currentUser.id === userId ? currentUser : null;
    
    if (!user) {
      toast.error("User not found");
      return null;
    }
    
    if (!user.reservedAccount?.accountReference) {
      toast.info("User doesn't have a reserved account");
      return null;
    }
    
    const result = await monnifyApi.getReservedAccountDetails(user.reservedAccount.accountReference);
    
    if (!result?.responseBody) {
      toast.error("Failed to get reserved account details");
      return user.reservedAccount;
    }
    
    const responseBody = result.responseBody;
    const reservedAccount: ReservedAccountData = {
      accountReference: responseBody.accountReference,
      accountName: responseBody.accountName,
      accountNumber: responseBody.accounts?.[0]?.accountNumber || "",
      bankName: responseBody.accounts?.[0]?.bankName || "",
      bankCode: responseBody.accounts?.[0]?.bankCode || "",
      reservationReference: responseBody.reservationReference,
      status: responseBody.status,
      createdOn: responseBody.createdOn,
      accounts: responseBody.accounts?.map(acc => ({
        bankCode: acc.bankCode,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber
      }))
    };
    
    if (userId === currentUser.id) {
      updateUser({ ...currentUser, reservedAccount });
    } else {
      updateUserById(userId, { reservedAccount });
    }
    
    return reservedAccount;
  } catch (error) {
    console.error("Error getting reserved account:", error);
    toast.error("Failed to get reserved account details. Please try again.");
    
    const currentUser = getCurrentUser();
    return currentUser.id === userId ? currentUser.reservedAccount : null;
  }
};

/**
 * Fetch transactions for a reserved account
 */
export const getReservedAccountTransactions = async (accountReference: string): Promise<any[] | null> => {
  try {
    const result = await monnifyApi.getReservedAccountTransactions(accountReference);
    
    if (!result || !result.responseBody) {
      return [];
    }
    
    // Update user wallet balance based on transactions
    const currentUser = getCurrentUser();
    const transactions = result.responseBody.content || [];
    
    // Process each transaction and update local records
    transactions.forEach(transaction => {
      if (transaction.paymentReference && !transactionExists(transaction.paymentReference)) {
        // Add transaction to local storage
        const newTransaction = {
          userId: currentUser.id,
          contributionId: "",
          type: "deposit",
          amount: transaction.amount,
          status: "completed",
          description: `Deposit via bank transfer (${transaction.bankName || 'Bank'})`,
          referenceId: transaction.paymentReference,
          paymentMethod: "bank_transfer",
          updatedAt: new Date().toISOString(),
          metaData: {
            senderName: transaction.senderName || transaction.paymentDescription || "Bank Transfer",
            bankName: transaction.bankName || "",
            narration: transaction.narration || transaction.paymentDescription || "",
            transactionReference: transaction.transactionReference || "",
            paymentReference: transaction.paymentReference || "",
          }
        };
        
        addTransaction(newTransaction);
        
        // Update user's wallet balance
        updateUserWalletById(currentUser.id, currentUser.walletBalance + transaction.amount);
      }
    });
    
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    toast.error("Failed to fetch transactions. Please try again.");
    return null;
  }
};

/**
 * Check if a transaction already exists in local storage
 */
const transactionExists = (referenceId: string): boolean => {
  try {
    const currentUser = getCurrentUser();
    const transactions = currentUser.transactions || [];
    return transactions.some(t => t.referenceId === referenceId);
  } catch (error) {
    return false;
  }
};

/**
 * Create a payment invoice for a user
 */
export const createPaymentInvoice = async (params: PaymentInvoiceParams): Promise<InvoiceData | null> => {
  try {
    const { amount, description, customerEmail, customerName, userId, contributionId } = params;
    
    if (!amount || amount <= 0 || !customerEmail || !customerName) {
      toast.error("Invalid payment parameters");
      return null;
    }
    
    const requestBody = {
      amount,
      customerName,
      customerEmail,
      paymentReference: `INV_${userId}_${Date.now()}`,
      paymentDescription: description || "Payment via card",
      currencyCode: "NGN",
      contractCode: "465595618981",
      redirectUrl: window.location.origin + "/dashboard"
    };
    
    const result = await monnifyApi.createInvoice(requestBody);
    
    if (!result || !result.responseBody) {
      toast.error("Failed to create payment invoice");
      return null;
    }
    
    const invoice: InvoiceData = {
      invoiceReference: result.responseBody.invoiceReference,
      description: result.responseBody.paymentDescription,
      amount: result.responseBody.amount,
      currencyCode: result.responseBody.currencyCode,
      status: result.responseBody.invoiceStatus,
      customerEmail: result.responseBody.customerEmail,
      customerName: result.responseBody.customerName,
      expiryDate: result.responseBody.expiryDate,
      redirectUrl: result.responseBody.redirectUrl,
      checkoutUrl: result.responseBody.checkoutUrl,
      createdOn: result.responseBody.createdOn,
      createdAt: new Date().toISOString(),
      contributionId: contributionId || ""
    };
    
    return invoice;
  } catch (error) {
    console.error("Error creating payment invoice:", error);
    toast.error("Failed to create payment invoice. Please try again.");
    return null;
  }
};
