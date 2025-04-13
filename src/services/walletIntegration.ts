
import { 
  getReservedAccountTransactions as fetchReservedAccountTransactions, 
  createContributionGroupAccount, 
  createPaymentInvoice as createPaymentInvoiceApi,
  createReservedAccount,
  getReservedAccountDetails
} from './monnifyApi';
import { User, Transaction, ReservedAccountData } from '@/types';
import { getCurrentUser, addTransaction, updateUser } from './localStorage';
import { toast } from 'sonner';

// Function to get reserved account transactions
export const getReservedAccountTransactions = async (accountReference: string): Promise<Transaction[]> => {
  try {
    const response = await fetchReservedAccountTransactions(accountReference);
    
    if (response.responseBody && Array.isArray(response.responseBody.content)) {
      const transactions: Transaction[] = response.responseBody.content.map((item: any) => {
        // Map Monnify transaction to your Transaction type
        return {
          id: item.paymentReference,
          userId: getCurrentUser().id,
          type: 'deposit',
          amount: item.amount,
          description: item.paymentDescription || 'Transaction from Monnify',
          status: item.paymentStatus === 'PAID' ? 'completed' : 'pending',
          createdAt: item.paidOn || new Date().toISOString(),
          metaData: {
            transactionReference: item.transactionReference,
            paymentReference: item.paymentReference,
            senderName: item.payerName,
            senderAccount: item.payerAccount,
            senderBank: item.payerBankName,
          },
        };
      });
      
      // Save transactions to local storage
      transactions.forEach(transaction => {
        addTransaction(transaction);
      });
      
      return transactions;
    } else {
      console.warn("No transactions found or invalid response format:", response);
      return [];
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    toast.error("Failed to fetch transactions. Please try again.");
    return [];
  }
};

// Function to create a contribution group account
export const createContributionAccount = async (contributionName: string): Promise<any> => {
  try {
    const user: User = getCurrentUser();
    const response = await createContributionGroupAccount(
      user.firstName || user.name?.split(' ')[0] || 'User', 
      user.lastName || user.name?.split(' ')[1] || 'Account', 
      contributionName
    );
    
    if (response.success) {
      return response;
    } else {
      toast.error(response.message || "Failed to create account for the group");
      return null;
    }
  } catch (error) {
    console.error("Error creating contribution account:", error);
    toast.error("Failed to create account for the group. Please try again.");
    return null;
  }
};

// Function to create a payment invoice
export const createPaymentInvoice = async (invoiceData: { 
  amount: number; 
  description: string; 
  customerEmail: string; 
  customerName: string; 
  userId: string 
}): Promise<any> => {
  try {
    const response = await createPaymentInvoiceApi(
      invoiceData.amount,
      invoiceData.description,
      invoiceData.customerEmail,
      invoiceData.customerName,
      invoiceData.userId
    );
    
    if (response.success) {
      return response;
    } else {
      toast.error(response.message || "Failed to create payment invoice");
      return null;
    }
  } catch (error) {
    console.error("Error creating payment invoice:", error);
    toast.error("Failed to create payment invoice. Please try again.");
    return null;
  }
};

// Functions for user's reserved account
export const getUserReservedAccount = async (user: User): Promise<ReservedAccountData | null> => {
  try {
    if (!user || !user.reservedAccount || !user.reservedAccount.accountReference) {
      return null;
    }
    
    const response = await getReservedAccountDetails(user.reservedAccount.accountReference);
    
    if (response && response.requestSuccessful && response.responseBody) {
      return response.responseBody as ReservedAccountData;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user reserved account:", error);
    return null;
  }
};

export const createUserReservedAccount = async (user: User): Promise<ReservedAccountData | null> => {
  try {
    if (!user || !user.email || !user.name) {
      toast.error("User data is incomplete");
      return null;
    }
    
    const firstName = user.firstName || user.name.split(' ')[0] || 'User';
    const lastName = user.lastName || user.name.split(' ')[1] || 'Account';
    
    // Prepare data for account creation
    const data = {
      accountReference: `USER_${user.id}_${Date.now()}`,
      accountName: `${firstName} ${lastName}`,
      currencyCode: "NGN",
      contractCode: "465595618981",
      customerEmail: user.email,
      customerName: `${firstName} ${lastName}`,
      customerBvn: "12345678901", // Default BVN 
      getAllAvailableBanks: true,
      preferredBanks: ["035"] // Default preferred bank
    };
    
    const response = await createReservedAccount(data);
    
    if (response.requestSuccessful && response.responseBody) {
      // Update user with new reserved account
      const accountDetails = response.responseBody as ReservedAccountData;
      user.reservedAccount = accountDetails;
      updateUser(user);
      
      toast.success("Virtual account created successfully");
      return accountDetails;
    } else {
      toast.error(response.responseMessage || "Failed to create virtual account");
      return null;
    }
  } catch (error) {
    console.error("Error creating user reserved account:", error);
    toast.error("Failed to create virtual account");
    return null;
  }
};

export { ReservedAccountData };
