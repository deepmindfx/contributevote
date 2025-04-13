import { 
  getReservedAccountTransactions as fetchReservedAccountTransactions, 
  createContributionGroupAccount, 
  createPaymentInvoice as createPaymentInvoiceApi
} from './monnifyApi';
import { User, Transaction } from '@/types';
import { getCurrentUser, addTransaction } from './localStorage';
import { toast } from 'sonner';

// Function to get reserved account transactions
export const getReservedAccountTransactions = async (accountReference: string): Promise<Transaction[]> => {
  try {
    const response = await fetchReservedAccountTransactions(accountReference);
    
    if (response.content && Array.isArray(response.content)) {
      const transactions: Transaction[] = response.content.map((item: any) => {
        // Map Monnify transaction to your Transaction type
        return {
          id: item.paymentReference,
          userId: getCurrentUser().id,
          type: item.type === 'CREDIT' ? 'deposit' : 'withdrawal',
          amount: item.amount,
          description: item.paymentDescription || 'Transaction from Monnify',
          status: item.status === 'SUCCESS' ? 'completed' : 'pending',
          createdAt: item.completedOn,
          metaData: {
            transactionReference: item.transactionReference,
            paymentReference: item.paymentReference,
            senderName: item.senderName,
            senderAccount: item.senderAccount,
            senderBank: item.senderBank,
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
    const response = await createContributionGroupAccount(user.firstName, user.lastName, contributionName);
    
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
export const createPaymentInvoice = async (invoiceData: { amount: number; description: string; customerEmail: string; customerName: string; userId: string }): Promise<any> => {
  try {
    const response = await createPaymentInvoiceApi(invoiceData.amount, invoiceData.description, invoiceData.customerEmail, invoiceData.customerName, invoiceData.userId);
    
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
