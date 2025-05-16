// Wallet Integration Service
// This file coordinates interactions with external payment services
import { toast } from "sonner";
import * as flutterwaveApi from "./flutterwaveApi";
import { 
  addTransaction, 
  getCurrentUser, 
  updateUserById,
  updateUser,
  updateUserBalance,
  getUsers
} from "./localStorage";
import { ReservedAccountData, InvoiceData } from "./wallet/types";
import { v4 as uuidv4 } from 'uuid';

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
 * Creates a virtual account for a user
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
      toast.error("BVN is required to create a virtual account");
      return null;
    }
    
    if (idType !== "bvn") {
      toast.error("Only BVN is supported for virtual account creation");
      return null;
    }
    
    // Create a unique transaction reference
    const txRef = `COLL_${userId}_${Date.now()}`;
    
    // Create the API request object
    const requestBody = {
      email: user.email,
      tx_ref: txRef,
      bvn: idNumber,
      narration: `Virtual account for ${user.name || `${user.firstName} ${user.lastName}`}`
    };
    
    const result = await flutterwaveApi.createVirtualAccount(requestBody);
    
    if (!result || !result.responseBody) {
      if (result && !result.success) {
        toast.error(result.message || "Failed to create virtual account");
      } else {
        toast.error("Failed to create virtual account");
      }
      return null;
    }
    
    const responseBody = result.responseBody;
    
    // Create the reserved account data object
    const reservedAccount: ReservedAccountData = {
      accountNumber: responseBody.account_number,
      bankName: responseBody.bank_name,
      accountName: user.name || `${user.firstName} ${user.lastName}`,
      flwRef: responseBody.flw_ref,
      orderRef: responseBody.order_ref,
      createdAt: new Date().toISOString()
    };
    
    // Update user with the new reserved account
    const updatedUser = {
      ...user,
      reservedAccount
    };
    
    updateUser(updatedUser);
    
    toast.success("Virtual account created successfully");
    return reservedAccount;
  } catch (error) {
    console.error("Error creating virtual account:", error);
    toast.error("Failed to create virtual account. Please try again.");
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
    
    const result = await flutterwaveApi.getReservedAccountDetails(user.reservedAccount.accountReference);
    
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
 * Check if a transaction already exists in local storage
 */
const transactionExists = (referenceId: string): boolean => {
  try {
    // Check in all transactions, not just user transactions
    const transactionsString = localStorage.getItem('transactions');
    if (!transactionsString) return false;
    
    const transactions = JSON.parse(transactionsString);
    
    // Check against multiple possible reference fields
    return transactions.some((t: any) => 
      t.referenceId === referenceId || 
      t.reference === referenceId || 
      t.id === referenceId ||
      t.transactionReference === referenceId ||
      t.tx_ref === referenceId ||
      (t.metaData && (
        t.metaData.paymentReference === referenceId || 
        t.metaData.transactionReference === referenceId ||
        t.metaData.tx_ref === referenceId
      ))
    );
  } catch (error) {
    console.error("Error checking if transaction exists:", error);
    return false;
  }
};

/**
 * Fetch transactions for a reserved account
 */
export const getReservedAccountTransactions = async (accountReference: string): Promise<any[] | null> => {
  try {
    // First check if the necessary function exists
    if (!flutterwaveApi.getReservedAccountTransactions) {
      console.error("getReservedAccountTransactions function not found in flutterwaveApi");
      return [];
    }
    
    // Log the attempt
    console.log(`Attempting to fetch transactions for account reference: ${accountReference}`);
    
    // Try multiple endpoint paths with correct server port
    let result;
    try {
      // Try the full path first
      result = await flutterwaveApi.getReservedAccountTransactions(accountReference);
    } catch (error) {
      console.log("Error with primary endpoint, trying backup endpoint");
      // If that fails, try direct endpoints with different port configs
      
      // Try API proxy path
      try {
        const response = await fetch(`/api/flutterwave/reserved-accounts/${accountReference}/transactions`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          result = { 
            success: true,
            responseBody: (await response.json()).data
          };
          console.log("Successfully fetched from API proxy endpoint");
        } else {
          console.log("API proxy endpoint failed, trying secondary endpoint");
          
          // Try the short path as a last resort
          const shortResponse = await fetch(`/reserved-accounts/${accountReference}/transactions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (shortResponse.ok) {
            result = { 
              success: true,
              responseBody: (await shortResponse.json()).data
            };
            console.log("Successfully fetched from short path endpoint");
          } else {
            console.error("All endpoint attempts failed");
          }
        }
      } catch (directError) {
        console.error("Direct endpoint also failed:", directError);
      }
    }
    
    // Check if we got any result
    if (!result || !result.responseBody) {
      console.log("No transactions found or empty response body");
      return [];
    }
    
    // Update user wallet balance based on transactions
    const currentUser = getCurrentUser();
    const transactions = result.responseBody.content || [];
    
    console.log(`Processing ${transactions.length} transactions for account reference ${accountReference}`);
    
    // Skip processing if no transactions
    if (transactions.length === 0) {
      console.log("No new transactions to process");
      return [];
    }
    
    // Track if any transactions were added
    let transactionsAdded = false;
    
    // Process each transaction and update local records
    for (const transaction of transactions) {
      // Make sure we have a valid reference to check
      const transactionRef = transaction.paymentReference || 
                             transaction.transactionReference || 
                             transaction.tx_ref;
                             
      console.log('Checking transaction:', transactionRef, transaction);
      
      if (transactionRef && !transactionExists(transactionRef)) {
        console.log('New transaction found:', transactionRef);
        transactionsAdded = true;
        
        // First check if this is a transfer to a contribution group
        const contributionsString = localStorage.getItem('contributions');
        const contributions = contributionsString ? JSON.parse(contributionsString) : [];
        console.log('Looking for matching contribution by account number');
        
        // Try to get account number from various possible fields
        const accountNumber = transaction.destinationAccountNumber || 
                              transaction.accountNumber || 
                              transaction.recipientAccountNumber;
        
        console.log('Looking for account number:', accountNumber);
        
        // Find if any contribution has this account number
        const matchingContribution = contributions.find(c => c.accountNumber === accountNumber);
        
        if (matchingContribution) {
          console.log(`Found matching contribution: ${matchingContribution.name} with ID ${matchingContribution.id}`);
          
          // This is a transaction for a specific contribution group
          console.log(`Adding ${transaction.amount} to contribution balance`);
          
          // Add contribution to the group
          matchingContribution.currentAmount += transaction.amount;
          
          // Add contributor to the contribution group
          const date = new Date().toISOString();
          matchingContribution.contributors.push({
            name: transaction.senderName || "Bank Transfer",
            amount: transaction.amount,
            date,
            anonymous: false,
          });
          
          // Update contribution in local storage
          const contributionIndex = contributions.findIndex(c => c.id === matchingContribution.id);
          if (contributionIndex >= 0) {
            contributions[contributionIndex] = matchingContribution;
            localStorage.setItem('contributions', JSON.stringify(contributions));
            console.log('Updated contribution in localStorage');
          }
          
          // Create a transaction record for the contribution
          const newTransaction = {
            id: transactionRef,
            userId: currentUser.id,
            contributionId: matchingContribution.id,
            type: "deposit",
            amount: transaction.amount,
            status: "completed",
            description: `Contribution to ${matchingContribution.name} via bank transfer`,
            referenceId: transactionRef,
            paymentMethod: "bank_transfer",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metaData: {
              senderName: transaction.senderName || transaction.paymentDescription || "Bank Transfer",
              bankName: transaction.bankName || "",
              narration: transaction.narration || transaction.paymentDescription || "",
              transactionReference: transaction.transactionReference || "",
              paymentReference: transaction.paymentReference || "",
              tx_ref: transaction.tx_ref || ""
            }
          };
          
          addTransaction(newTransaction);
          console.log('Added transaction to localStorage');
          
          // Notify the creator of the contribution
          if (matchingContribution.creatorId) {
            const users = getUsers();
            const creator = users.find(u => u.id === matchingContribution.creatorId);
            
            if (creator) {
              // Add notification if we have the creator
              const notifications = creator.notifications || [];
              notifications.push({
                id: uuidv4(),
                userId: creator.id,
                message: `New contribution of ₦${transaction.amount.toLocaleString()} received for ${matchingContribution.name}`,
                type: 'success',
                read: false,
                createdAt: new Date().toISOString(),
                relatedId: matchingContribution.id
              });
              
              // Update creator with new notification
              const userIndex = users.findIndex(u => u.id === creator.id);
              if (userIndex >= 0) {
                users[userIndex].notifications = notifications;
                localStorage.setItem('users', JSON.stringify(users));
              }
            }
          }
          
          toast.success(`Contribution of ₦${transaction.amount.toLocaleString()} added to ${matchingContribution.name}`);
        } else {
          // Regular wallet deposit
          console.log('No matching contribution found, treating as regular wallet deposit');
          
          const newTransaction = {
            id: transactionRef,
            userId: currentUser.id,
            contributionId: "",
            type: "deposit",
            amount: transaction.amount,
            status: "completed",
            description: `Deposit via bank transfer (${transaction.bankName || 'Bank'})`,
            referenceId: transactionRef,
            paymentMethod: "bank_transfer",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metaData: {
              senderName: transaction.senderName || transaction.paymentDescription || "Bank Transfer",
              bankName: transaction.bankName || "",
              narration: transaction.narration || transaction.paymentDescription || "",
              transactionReference: transaction.transactionReference || "",
              paymentReference: transaction.paymentReference || "",
              tx_ref: transaction.tx_ref || ""
            }
          };
          
          // First, check if the transaction already exists
          const existingTransactions = localStorage.getItem('transactions');
          const transactions = existingTransactions ? JSON.parse(existingTransactions) : [];
          const exists = transactions.some((t: any) => t.id === transactionRef || t.referenceId === transactionRef);
          
          if (!exists) {
            addTransaction(newTransaction);
            console.log('Added transaction record to localStorage');
            
            // Update user's wallet balance
            const updatedBalance = currentUser.walletBalance + transaction.amount;
            updateUserBalance(currentUser.id, updatedBalance);
            console.log(`Updated wallet balance: ${updatedBalance}`);
            
            // Show success notification
            toast.success(`₦${transaction.amount.toLocaleString()} has been deposited to your wallet`);
          } else {
            console.log('Transaction already exists, skipping');
          }
        }
      }
    }
    
    // If we added transactions, return them for UI update
    if (transactionsAdded) {
      console.log("Transactions processed and added to wallet");
      return transactions;
    }
    
    // If no new transactions were found
    return [];
  } catch (error) {
    console.error("Error fetching transactions:", error);
    toast.error("Failed to fetch transactions. Please try again.");
    return [];
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
    
    const result = await flutterwaveApi.createInvoice(requestBody);
    
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
