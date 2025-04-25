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
    
    // First check if we have the user ID
    if (!userId) {
      console.error("User ID is required but was not provided");
      throw new Error("User ID is required");
    }

    // Get current logged in user first
    const currentUser = getCurrentUser();
    let user = null;
    
    // If current user matches requested userId, use it
    if (currentUser && currentUser.id === userId) {
      console.log("Using current logged in user");
      user = currentUser;
    } else {
      // Otherwise fetch from users array
      console.log("Current user doesn't match, looking in users array");
      const usersStr = localStorage.getItem('users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      user = users.find((u: any) => u.id === userId);
    }
    
    if (!user) {
      console.error(`User with ID ${userId} not found in current user or users array`);
      throw new Error('User not found');
    }
    
    console.log(`Found user for virtual account: ${user.name || user.email}`);
    
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
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
      isPermanent: true,
      bvn: idNumber,
      narration: `Please make a bank transfer to ${user.name || user.email}`
    });
    
    if (!result.requestSuccessful) {
      throw new Error(result.responseMessage || 'Failed to create virtual account');
    }
    
    console.log("Virtual account API response:", result);
    
    // Create account data structure
    const accountData = {
      accountNumber: result.responseBody.accounts[0].accountNumber,
      bankName: result.responseBody.accounts[0].bankName,
      accountName: result.responseBody.accountName,
      accountReference: result.responseBody.accountReference,
      accounts: result.responseBody.accounts
    };
    
    console.log("Reserved account data:", accountData);
    
    // Update user in local storage users array
    const usersStr = localStorage.getItem('users');
    const users = usersStr ? JSON.parse(usersStr) : [];
    const updatedUsers = users.map((u: any) => {
      if (u.id === userId) {
        console.log(`Updating user ${u.id} with reserved account`);
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
    if (currentUser && currentUser.id === userId) {
      console.log("Also updating current user with reserved account");
      currentUser.reservedAccount = accountData;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    // Update user in the profiles table to ensure persistence
    try {
      console.log("Updating user profile with reserved account");
      updateUser({ reservedAccount: accountData });
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
