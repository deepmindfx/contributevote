import {
  createVirtualAccount,
  createGroupVirtualAccount
} from './flutterwave/virtualAccounts';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './localStorage/types';

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
  status: string;
  message: string;
  data: {
    account_number: string;
    bank_name: string;
    note: string;
    flw_ref: string;
    order_ref: string;
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
    // Get user data
    const usersStr = localStorage.getItem('users');
    const users = usersStr ? JSON.parse(usersStr) : [];
    const user = users.find((u: any) => u.id === userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Create virtual account with Flutterwave
    const result = await createVirtualAccount({
      email: user.email,
      name: user.name || `${user.firstName} ${user.lastName}`,
      isPermanent: true,
      bvn: idType === 'bvn' ? idNumber : undefined,
      narration: `Please make a bank transfer to ${user.name || `${user.firstName} ${user.lastName}`}`
    });
    
    if (!result.requestSuccessful) {
      throw new Error(result.responseMessage || 'Failed to create virtual account');
    }
    
    // Update user with reserved account details
    const updatedUsers = users.map((u: any) => {
      if (u.id === userId) {
        return {
          ...u,
          reservedAccount: {
            accountNumber: result.responseBody.accounts[0].accountNumber,
            bankName: result.responseBody.accounts[0].bankName,
            accountName: result.responseBody.accountName,
            accountReference: result.responseBody.accountReference,
            accounts: result.responseBody.accounts
          }
        };
      }
      return u;
    });
    
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    return {
      accountNumber: result.responseBody.accounts[0].accountNumber,
      bankName: result.responseBody.accounts[0].bankName,
      accountName: result.responseBody.accountName,
      accountReference: result.responseBody.accountReference,
      accounts: result.responseBody.accounts
    };
  } catch (error) {
    console.error('Error creating user reserved account:', error);
    throw error;
  }
};
