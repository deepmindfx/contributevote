
import { v4 as uuidv4 } from "uuid";
import { ReservedAccountData, BankTransaction, BankTransactionResponse } from "./types";
import { 
  getCurrentUser, 
  getAllTransactions, 
  updateUserById,
  addTransaction
} from "../localStorage";

// Mock API response times
const MOCK_API_DELAY = 800;

/**
 * Create a reserved account for a user
 * In a real app, this would call an actual payment gateway API
 * @returns Promise<ReservedAccountData>
 */
export const createReservedAccount = async (): Promise<ReservedAccountData> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));
  
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    throw new Error("User not found");
  }
  
  // Check if user already has a reserved account
  if (currentUser.reservedAccount) {
    return currentUser.reservedAccount;
  }
  
  // Generate mock account data
  const accountNumber = `30${Math.floor(Math.random() * 90000000) + 10000000}`; // 10-digit number starting with 30
  const accountName = `${currentUser.firstName?.toUpperCase()} ${currentUser.lastName?.toUpperCase()}`;
  
  const reservedAccount: ReservedAccountData = {
    accountNumber,
    accountName,
    bankName: "CollectiPay Bank",
    bankCode: "303",
    reference: `rac_${uuidv4().substring(0, 8)}`,
    accountReference: `COLL_${uuidv4()}_${Date.now()}`,
    reservationReference: `res_${uuidv4().substring(0, 8)}`,
    status: "active",
    createdOn: new Date().toISOString()
  };
  
  // Update user with the new reserved account
  updateUserById(currentUser.id, {
    reservedAccount
  });
  
  return reservedAccount;
};

/**
 * Get a user's reserved account details
 * @returns ReservedAccountData | null
 */
export const getReservedAccount = (): ReservedAccountData | null => {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return null;
  }
  
  return currentUser.reservedAccount || null;
};

/**
 * Fetch the bank account transaction history
 * In a real app, this would call a payment gateway's API
 * @param page Page number (1-indexed)
 * @param limit Number of transactions per page
 * @returns Promise<BankTransactionResponse>
 */
export const getBankTransactions = async (
  page: number = 1,
  limit: number = 10
): Promise<BankTransactionResponse> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));
  
  const currentUser = getCurrentUser();
  
  if (!currentUser || !currentUser.reservedAccount) {
    return {
      data: [],
      meta: {
        currentPage: page,
        totalPages: 0,
        totalRecords: 0
      }
    };
  }
  
  // Get all transactions for the user that are deposits
  const allTransactions = getAllTransactions();
  const userTransactions = allTransactions.filter(
    transaction => 
      transaction.userId === currentUser.id && 
      transaction.type === "deposit" &&
      transaction.metaData?.paymentMethod === "bank_transfer"
  );
  
  // Sort by date descending (newest first)
  userTransactions.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Paginate
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedTransactions = userTransactions.slice(startIndex, endIndex);
  
  // Format as BankTransaction objects
  const formattedTransactions: BankTransaction[] = paginatedTransactions.map(t => ({
    id: t.id,
    amount: t.amount,
    type: "credit", // All reserved account transactions are credits
    status: t.status === "completed" ? "successful" : "pending",
    reference: t.metaData?.reference || "N/A",
    senderName: t.metaData?.senderName || "Bank Transfer",
    senderBank: t.metaData?.senderBank || "Unknown Bank",
    createdAt: t.createdAt,
    settledAt: t.status === "completed" ? t.createdAt : null,
    narration: t.metaData?.narration || t.description || "Bank Transfer"
  }));
  
  return {
    data: formattedTransactions,
    meta: {
      currentPage: page,
      totalPages: Math.ceil(userTransactions.length / limit),
      totalRecords: userTransactions.length
    }
  };
};

/**
 * Mock function to simulate an incoming bank transfer to a reserved account
 * In a real app, this would be handled by webhooks from the payment provider
 * @param amount Amount of the transfer
 * @param senderName Name of the sender
 * @param senderBank Sender's bank name
 * @returns Promise<boolean>
 */
export const simulateIncomingBankTransfer = async (
  amount: number,
  senderName: string = "Bank Customer",
  senderBank: string = "Bank"
): Promise<boolean> => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const currentUser = getCurrentUser();
  
  if (!currentUser || !currentUser.reservedAccount) {
    console.error("Cannot simulate transfer: User not found or no reserved account");
    return false;
  }
  
  try {
    // Generate a unique reference
    const reference = `trf_${uuidv4().substring(0, 8)}`;
    
    // Update user wallet balance
    updateUserById(currentUser.id, {
      walletBalance: currentUser.walletBalance + amount
    });
    
    // Create transaction record
    const transactionData = {
      userId: currentUser.id,
      type: "deposit" as const, 
      amount: amount,
      contributionId: "", 
      description: `Deposit via bank transfer from ${senderName}`,
      status: "completed" as const, 
      createdAt: new Date().toISOString(),
      metaData: {
        paymentMethod: "bank_transfer",
        reference,
        senderName,
        senderBank,
        accountNumber: currentUser.reservedAccount.accountNumber,
        narration: `Transfer from ${senderName}`
      }
    };
    
    // Add transaction to storage
    addTransaction(transactionData);
    
    return true;
  } catch (error) {
    console.error("Error simulating bank transfer:", error);
    return false;
  }
};

/**
 * Function to get reserved account transactions
 * @param accountReference The account reference ID
 * @returns Promise with transaction data
 */
export const getReservedAccountTransactions = async (accountReference: string) => {
  console.info("Getting reserved account transactions for:", accountReference);
  
  try {
    // In a real app, this would be an API call
    // For now, we'll simulate one with our local data
    // Use getBankTransactions instead of trying to call an API
    const transactions = await getBankTransactions(1, 50);
    
    return {
      content: transactions.data,
      totalElements: transactions.meta.totalRecords,
      totalPages: transactions.meta.totalPages
    };
  } catch (error) {
    console.error("Error getting reserved account transactions:", error);
    // Return an empty result instead of throwing
    return {
      content: [],
      totalElements: 0,
      totalPages: 0
    };
  }
};

// Export the default object
export default {
  createReservedAccount,
  getReservedAccount,
  getBankTransactions,
  simulateIncomingBankTransfer,
  getReservedAccountTransactions
};
