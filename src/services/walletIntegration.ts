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
  responseBody: {
    accounts: Array<{
      accountNumber: string;
      bankName: string;
    }>;
    accountReference: string;
    accountName: string;
  };
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
    const currentUser = getCurrentUser();
    let user = null;
    
    // If current user matches requested userId, use it
    if (currentUser && currentUser.id === userId) {
      user = currentUser;
    } else {
      const usersStr = localStorage.getItem('users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      user = users.find((u: any) => u.id === userId);
    }
    
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
      firstname: user.firstName || user.name?.split(' ')[0] || '',
      lastname: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
      is_permanent: true,
      bvn: idNumber,
      narration: `Virtual Account for ${user.firstName || ''} ${user.lastName || ''}`
    });
    
    if (!result.requestSuccessful) {
      throw new Error(result.responseMessage || 'Failed to create virtual account');
    }
    
    // Create account data structure
    const accountData = {
      accountNumber: result.responseBody.accounts[0].accountNumber,
      bankName: result.responseBody.accounts[0].bankName,
      accountName: result.responseBody.accountName,
      accountReference: result.responseBody.accountReference,
      accounts: result.responseBody.accounts
    };
    
    // Update user in local storage
    const usersStr = localStorage.getItem('users');
    const users = usersStr ? JSON.parse(usersStr) : [];
    const updatedUsers = users.map((u: any) => {
      if (u.id === userId) {
        return {
          ...u,
          reservedAccount: accountData
        };
      }
      return u;
    });
    
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    // Update current user if applicable
    if (currentUser && currentUser.id === userId) {
      currentUser.reservedAccount = accountData;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    return accountData;
  } catch (error) {
    console.error('Error creating user reserved account:', error);
    throw error;
  }
};
