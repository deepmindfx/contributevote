
import {
  createVirtualAccount,
  createGroupVirtualAccount
} from './flutterwave/virtualAccounts';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './localStorage/types';
import { updateUser, getCurrentUser } from './localStorage';

// Re-export virtual account functions
export {
  createVirtualAccount as getUserReservedAccount,
  createGroupVirtualAccount as createContributionGroupAccount,
};

// Add type exports
export interface ReservedAccountData {
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  accountReference?: string;
  accounts?: Array<{
    accountNumber: string;
    bankName: string;
  }>;
}

export interface VirtualAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseBody: ReservedAccountData | null;
}

export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    // Get transactions from localStorage for now
    const transactionsStr = localStorage.getItem('transactions');
    const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
    
    // Filter transactions for this account
    const accountTransactions = transactions.filter((t: Transaction) => 
      t.accountReference === accountReference
    );

    return {
      requestSuccessful: true,
      responseBody: {
        content: accountTransactions
      }
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      requestSuccessful: false,
      responseBody: {
        content: []
      }
    };
  }
};

export const createPaymentInvoice = async (data: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
}) => {
  try {
    // Create a mock invoice for now
    const invoice = {
      amount: data.amount,
      description: data.description,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      invoiceReference: `INV-${uuidv4()}`,
      checkoutUrl: `#/pay/${uuidv4()}`,
      status: 'PENDING'
    };

    // Store in localStorage
    const invoicesStr = localStorage.getItem('invoices');
    const invoices = invoicesStr ? JSON.parse(invoicesStr) : [];
    invoices.push(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));

    return {
      checkoutUrl: invoice.checkoutUrl,
      invoiceReference: invoice.invoiceReference
    };
  } catch (error) {
    console.error('Error creating payment invoice:', error);
    return null;
  }
};

export const createUserReservedAccount = async (userId: string, idType: string, idNumber: string) => {
  try {
    console.log("Creating reserved account for user ID:", userId);
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Get current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not found');
    }

    console.log(`Found user for virtual account: ${user.firstName} ${user.lastName}`);
    
    if (idType !== 'bvn') {
      throw new Error('BVN is required for creating virtual accounts');
    }

    if (!idNumber) {
      throw new Error('BVN number is required');
    }

    if (idNumber.length !== 11 || !/^\d+$/.test(idNumber)) {
      throw new Error('BVN must be 11 digits');
    }
    
    // Create virtual account with Flutterwave
    const result = await createVirtualAccount({
      email: user.email,
      firstname: user.firstName,
      lastname: user.lastName,
      is_permanent: true,
      bvn: idNumber,
      narration: `Virtual Account for ${user.firstName} ${user.lastName}`
    });
    
    if (!result.requestSuccessful) {
      throw new Error(result.responseMessage || 'Failed to create virtual account');
    }
    
    // Create account data structure
    const accountData = result.responseBody;
    
    // Update user in local storage
    updateUser(user.id, {
      ...user,
      reservedAccount: accountData
    });
    
    return accountData;
  } catch (error) {
    console.error('Error creating user reserved account:', error);
    throw error;
  }
};
