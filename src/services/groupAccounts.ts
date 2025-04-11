
import * as monnifyApi from "./monnifyApi";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { 
  Contribution, 
  getContributions, 
  updateContribution,
  contributeByAccountNumber
} from "./localStorage";

/**
 * Creates a reserved account for a contribution group
 * @param contributionId The contribution ID
 * @returns The account details or null if creation failed
 */
export const createGroupReservedAccount = async (contributionId: string): Promise<any> => {
  try {
    // Get the contribution
    const contributions = getContributions();
    const contribution = contributions.find(c => c.id === contributionId);
    
    if (!contribution) {
      toast.error("Contribution not found");
      return null;
    }
    
    // Check if contribution already has a reserved account
    if (contribution.accountNumber) {
      console.log("Contribution already has a reserved account:", contribution.accountNumber);
      return {
        accountNumber: contribution.accountNumber,
        bankName: contribution.bankName || "Bank"
      };
    }
    
    // Create account reference
    const accountReference = `GROUP_${contributionId}_${Date.now()}`;
    
    // Create API request
    const requestBody = {
      accountReference,
      accountName: `Group - ${contribution.name}`,
      customerEmail: "group@collectiv.com", // We could use creator's email here
      customerName: contribution.name,
      currencyCode: "NGN",
      contractCode: "465595618981", // Using provided contract code
      getAllAvailableBanks: true
    };
    
    // Call Monnify API to create reserved account
    const result = await monnifyApi.createReservedAccount(requestBody);
    
    if (!result || !result.responseBody) {
      if (result && !result.success) {
        toast.error(result.message || "Failed to create group account");
      } else {
        toast.error("Failed to create group account");
      }
      return null;
    }
    
    // Extract account details
    const responseBody = result.responseBody;
    const mainAccount = responseBody.accounts && responseBody.accounts.length > 0 
      ? responseBody.accounts[0] 
      : null;
    
    if (!mainAccount) {
      toast.error("No account details returned");
      return null;
    }
    
    // Update contribution with account details
    const updatedContribution = {
      ...contribution,
      accountNumber: mainAccount.accountNumber,
      bankName: mainAccount.bankName,
      bankCode: mainAccount.bankCode,
      accountReference: responseBody.accountReference,
      reservationReference: responseBody.reservationReference
    };
    
    // Save updated contribution
    updateContribution(updatedContribution);
    
    toast.success("Group account created successfully");
    
    return {
      accountNumber: mainAccount.accountNumber,
      bankName: mainAccount.bankName
    };
  } catch (error) {
    console.error("Error creating group reserved account:", error);
    toast.error("Failed to create group account");
    return null;
  }
};

/**
 * Process payments made to a group account
 * This would be called by a webhook in a production environment
 * For this demo, it's called manually when retrieving transactions
 */
export const processGroupAccountPayment = async (data: {
  accountReference: string;
  transactionReference: string;
  paymentReference: string;
  amountPaid: number;
  paidOn: string;
  paymentDescription: string;
  destinationAccountNumber?: string;
  destinationBankName?: string;
  contributorInfo?: {
    name: string;
    email?: string;
    phone?: string;
  };
  anonymous?: boolean;
}) => {
  try {
    const {
      accountReference,
      transactionReference,
      paymentReference,
      amountPaid,
      paidOn,
      paymentDescription,
      destinationAccountNumber,
      destinationBankName,
      contributorInfo,
      anonymous
    } = data;
    
    // Find the contribution by account reference
    const contributions = getContributions();
    const contribution = contributions.find(c => c.accountReference === accountReference);
    
    if (!contribution) {
      console.error("Contribution not found for account reference:", accountReference);
      return null;
    }
    
    // Handle the contribution
    const contributorName = contributorInfo?.name || "External Contributor";
    const contributorEmail = contributorInfo?.email || "";
    const contributorPhone = contributorInfo?.phone || "";
    
    // Use the contributeByAccountNumber function
    contributeByAccountNumber(
      contribution.accountNumber,
      amountPaid,
      {
        name: contributorName,
        email: contributorEmail,
        phone: contributorPhone
      },
      anonymous || false,
      paymentReference
    );
    
    return {
      success: true,
      contributionId: contribution.id,
      amount: amountPaid
    };
  } catch (error) {
    console.error("Error processing group payment:", error);
    return null;
  }
};

/**
 * Fetch and process transactions for a group account
 * @param contributionId The contribution ID
 */
export const getGroupAccountTransactions = async (contributionId: string) => {
  try {
    // Get the contribution
    const contributions = getContributions();
    const contribution = contributions.find(c => c.id === contributionId);
    
    if (!contribution || !contribution.accountReference) {
      console.log("Contribution not found or has no account reference");
      return [];
    }
    
    // Fetch transactions from Monnify
    const result = await monnifyApi.getReservedAccountTransactions(contribution.accountReference);
    
    if (!result || !result.responseBody || !result.responseBody.content) {
      console.log("No transactions found for this group");
      return [];
    }
    
    // Process each transaction
    const transactions = result.responseBody.content;
    console.log(`Found ${transactions.length} transactions for group ${contribution.name}`);
    
    for (const transaction of transactions) {
      // Process each transaction that hasn't been processed yet
      await processGroupAccountPayment({
        accountReference: contribution.accountReference,
        transactionReference: transaction.transactionReference,
        paymentReference: transaction.paymentReference,
        amountPaid: transaction.amount,
        paidOn: transaction.paidOn,
        paymentDescription: `Bank transfer to ${contribution.name}`,
        destinationAccountNumber: transaction.destinationAccountNumber,
        destinationBankName: transaction.destinationBankName,
        contributorInfo: {
          name: "Bank Transfer"
        }
      });
    }
    
    return transactions;
  } catch (error) {
    console.error("Error fetching group transactions:", error);
    return [];
  }
};
