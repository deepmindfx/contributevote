
import {
  createVirtualAccount,
  createGroupVirtualAccount
} from './flutterwave/virtualAccounts';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from './localStorage/types';
import { updateUser } from './localStorage';

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
  } | null;
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
      console.error(`User not found with ID: ${userId}`);
      throw new Error('User not found');
    }
    
    console.log(`Creating virtual account for user ${userId} with ${idType}: ${idNumber ? "****" : "Not provided"}`);
    
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
      name: user.name || `${user.firstName} ${user.lastName}`,
      isPermanent: true,
      bvn: idNumber,
      narration: `Please make a bank transfer to ${user.name || `${user.firstName} ${user.lastName}`}`
    });
    
    if (!result.requestSuccessful) {
      console.error('Failed to create virtual account:', result.responseMessage);
      throw new Error(result.responseMessage || 'Failed to create virtual account');
    }
    
    console.log("Virtual account API response:", result);
    
    // Create account data structure
    const accountData = {
      accountNumber: result.responseBody?.accounts[0].accountNumber,
      bankName: result.responseBody?.accounts[0].bankName,
      accountName: result.responseBody?.accountName,
      accountReference: result.responseBody?.accountReference,
      accounts: result.responseBody?.accounts
    };
    
    // Update user with reserved account details
    const updatedUsers = users.map((u: any) => {
      if (u.id === userId) {
        return {
          ...u,
          reservedAccount: accountData
        };
      }
      return u;
    });
    
    // Save updated users to localStorage
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    // Also update the current user if this is for the current user
    const currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
      const currentUser = JSON.parse(currentUserStr);
      if (currentUser && currentUser.id === userId) {
        currentUser.reservedAccount = accountData;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    }
    
    // Update user in the profiles table to ensure persistence
    try {
      updateUser({ 
        id: userId, 
        reservedAccount: accountData 
      });
    } catch (error) {
      console.error("Failed to update user profile with reserved account:", error);
      // Continue since we already updated the users array
    }
    
    console.log(`Successfully created and saved virtual account for user ${userId}`);
    
    return accountData;
  } catch (error) {
    console.error('Error creating user reserved account:', error);
    throw error;
  }
};
