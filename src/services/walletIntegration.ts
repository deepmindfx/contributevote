
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import * as monnifyApi from "./monnifyApi";
import { 
  User, 
  updateUser, 
  getCurrentUser, 
  getTransactions, 
  updateUserById, 
  addTransaction 
} from "./localStorage";

/**
 * Interface for the reserved account data stored in user settings
 */
export interface ReservedAccountData {
  accountReference: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  reservationReference: string;
  status: string;
  createdOn: string;
  accounts?: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
}

/**
 * Interface for card token data stored in user settings
 */
export interface CardTokenData {
  token: string;
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  issuer: string;
  cardType: string;
  createdOn: string;
}

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
    
    if (!result) {
      toast.error("Failed to create reserved account");
      return null;
    }
    
    // Extract relevant account data
    const reservedAccount: ReservedAccountData = {
      accountReference: result.accountReference,
      accountName: result.accountName,
      accountNumber: result.accounts && result.accounts.length > 0 ? result.accounts[0].accountNumber : "",
      bankName: result.accounts && result.accounts.length > 0 ? result.accounts[0].bankName : "",
      bankCode: result.accounts && result.accounts.length > 0 ? result.accounts[0].bankCode : "",
      reservationReference: result.reservationReference,
      status: result.status,
      createdOn: result.createdOn,
      accounts: result.accounts?.map(acc => ({
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
    
    if (!result) {
      toast.error("Failed to get reserved account details");
      return user.reservedAccount; // Return cached version
    }
    
    // Extract relevant account data
    const reservedAccount: ReservedAccountData = {
      accountReference: result.accountReference,
      accountName: result.accountName,
      accountNumber: result.accounts && result.accounts.length > 0 ? result.accounts[0].accountNumber : "",
      bankName: result.accounts && result.accounts.length > 0 ? result.accounts[0].bankName : "",
      bankCode: result.accounts && result.accounts.length > 0 ? result.accounts[0].bankCode : "",
      reservationReference: result.reservationReference,
      status: result.status,
      createdOn: result.createdOn,
      accounts: result.accounts?.map(acc => ({
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
    
    if (result && result.content) {
      // Process the transactions and add them to the local storage
      for (const transaction of result.content) {
        processReservedAccountTransaction({
          transactionReference: transaction.transactionReference,
          paymentReference: transaction.paymentReference,
          amountPaid: transaction.amount,
          totalPayable: transaction.amount,
          settlementAmount: transaction.amount,
          paidOn: transaction.paidOn,
          paymentStatus: transaction.paymentStatus,
          paymentDescription: `Bank transfer from ${transaction.destinationBankName}`,
          metaData: {},
          accountDetails: {
            accountName: transaction.destinationAccountName,
            accountNumber: transaction.destinationAccountNumber,
            bankCode: '',
            bankName: transaction.destinationBankName
          }
        });
      }
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching reserved account transactions:", error);
    toast.error("Failed to fetch transactions. Please try again.");
    return null;
  }
};

/**
 * Creates an invoice for a user or contribution
 * @param data Invoice data
 * @returns Invoice details
 */
export const createPaymentInvoice = async (data: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  expiryDate?: Date;
  contributionId?: string;
  userId: string;
  redirectUrl?: string;
}): Promise<any> => {
  try {
    const {
      amount,
      description,
      customerEmail,
      customerName,
      expiryDate,
      contributionId,
      userId,
      redirectUrl
    } = data;
    
    // Generate a unique invoice reference
    const invoiceReference = `INV_${userId}_${Date.now()}`;
    
    // Create the invoice data
    const invoiceData: any = {
      amount,
      invoiceReference,
      description,
      customerEmail,
      customerName,
      expiryDate: expiryDate ? expiryDate.toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      redirectUrl: redirectUrl || window.location.origin + "/dashboard"
    };
    
    // Get user data to check for reserved account
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    // If user has a reserved account, link it to the invoice
    if (user?.reservedAccount) {
      Object.assign(invoiceData, { accountReference: user.reservedAccount.accountReference });
    }
    
    // If this is for a contribution, add it to the metadata
    const metaData = contributionId ? { contributionId } : undefined;
    
    // Create the invoice
    const result = await monnifyApi.createInvoice({
      ...invoiceData,
      metaData
    });
    
    if (!result) {
      toast.error("Failed to create invoice");
      return null;
    }
    
    // Store the invoice in the user's data
    const userInvoices = user?.invoices || [];
    const newInvoice = {
      ...result,
      createdAt: new Date().toISOString(),
      status: result.status,
      contributionId: contributionId || ""
    };
    
    if (userId === currentUser.id) {
      // Update current user
      updateUser({ 
        ...currentUser, 
        invoices: [...userInvoices, newInvoice] 
      });
    } else {
      // Update other user (admin action)
      updateUserById(userId, { 
        invoices: [...userInvoices, newInvoice] 
      });
    }
    
    toast.success("Invoice created successfully");
    return result;
  } catch (error) {
    console.error("Error creating invoice:", error);
    toast.error("Failed to create invoice. Please try again.");
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
        bankName: accountDetails.bankName,
        accountNumber: accountDetails.accountNumber
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

/**
 * Saves a card token for a user
 * @param userId The user ID
 * @param cardData Card data to save
 */
export const saveCardToken = async (userId: string, cardData: CardTokenData): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    // Save card token to user data
    const userCards = user.cardTokens || [];
    
    // Check if card already exists
    const existingCardIndex = userCards.findIndex(
      card => card.lastFourDigits === cardData.lastFourDigits
    );
    
    if (existingCardIndex >= 0) {
      // Update existing card
      userCards[existingCardIndex] = cardData;
    } else {
      // Add new card
      userCards.push(cardData);
    }
    
    // Update user data
    if (userId === currentUser.id) {
      updateUser({
        ...currentUser,
        cardTokens: userCards
      });
    } else {
      updateUserById(userId, {
        cardTokens: userCards
      });
    }
    
    toast.success("Card saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving card token:", error);
    toast.error("Failed to save card. Please try again.");
    return false;
  }
};

/**
 * Charges a saved card
 * @param userId The user ID
 * @param cardToken The card token
 * @param amount The amount to charge
 * @param description Payment description
 * @param contributionId Optional contribution ID if this is for a contribution
 */
export const chargeSavedCard = async (
  userId: string,
  cardToken: string,
  amount: number,
  description: string,
  contributionId?: string
): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    const allUsers = [currentUser]; // In a real app, this would be fetched from a database
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      toast.error("User not found");
      return false;
    }
    
    // Generate a unique payment reference
    const paymentReference = `PAY_${userId}_${Date.now()}`;
    
    // Set up metadata
    const metaData: Record<string, any> = {
      userId
    };
    
    if (contributionId) {
      metaData.contributionId = contributionId;
    }
    
    // Charge the card
    const result = await monnifyApi.chargeCardToken({
      cardToken,
      amount,
      customerName: user.name || `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      paymentReference,
      paymentDescription: description,
      metaData
    });
    
    if (!result) {
      toast.error("Failed to charge card");
      return false;
    }
    
    // Process the payment
    if (result.paymentStatus === "PAID") {
      if (contributionId) {
        // Process as a contribution payment
        // This would call the existing contribution logic
        // But we're just logging it for now to avoid modifying existing code
        console.log("Processing contribution payment:", contributionId, amount);
        
        // You would call your existing contribution logic here
        // For example:
        // contributeToGroup(contributionId, amount);
      } else {
        // Process as a wallet top-up
        // Add transaction record
        addTransaction({
          id: result.transactionReference,
          userId,
          type: "deposit" as "deposit" | "withdrawal" | "transfer" | "vote",
          amount,
          contributionId: "",
          description: description || "Wallet top-up via card",
          status: "completed" as "completed" | "pending" | "failed",
          createdAt: new Date().toISOString(),
          metaData: {
            paymentReference,
            cardType: result.cardType
          }
        });
        
        // Update user's wallet balance
        if (userId === currentUser.id) {
          updateUser({
            ...currentUser,
            walletBalance: (currentUser.walletBalance || 0) + amount
          });
        } else {
          // Admin action for other user
          updateUserById(userId, {
            walletBalance: (currentUser.walletBalance || 0) + amount
          });
        }
      }
      
      toast.success(`Card charged successfully: ₦${amount.toLocaleString()}`);
      return true;
    } else {
      toast.error(`Payment failed: ${result.paymentStatus}`);
      return false;
    }
  } catch (error) {
    console.error("Error charging card:", error);
    toast.error("Failed to charge card. Please try again.");
    return false;
  }
};
