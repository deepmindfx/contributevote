
import { v4 as uuidv4 } from 'uuid';
import { createTransaction } from './localStorage';

// Define types
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

export interface PaymentInvoiceParams {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
  redirectUrl?: string;
}

export interface PaymentInvoiceResult {
  checkoutUrl?: string;
  reference?: string;
  status?: string;
  error?: string;
}

// Create a reserved account for a user using their BVN or NIN
export const createUserReservedAccount = async (
  userId: string, 
  bvn?: string, 
  nin?: string
): Promise<ReservedAccountData | null> => {
  try {
    // Get user details from storage or context
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (!currentUser || !currentUser.email) {
      throw new Error('User details not available');
    }

    // Prepare the request payload
    const payload = {
      email: currentUser.email,
      name: currentUser.name || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      bvn,
      nin,
      isPermanent: true
    };
    
    const response = await createVirtualAccount(payload);

    if (response && response.requestSuccessful && response.responseBody) {
      // Update user data in local storage with the reserved account details
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = users.findIndex((u: any) => u.id === userId);
      
      if (userIndex >= 0) {
        users[userIndex].reservedAccount = response.responseBody;
        localStorage.setItem('users', JSON.stringify(users));
      }
      
      // Also update current user if that's the user we're updating
      if (currentUser.id === userId) {
        currentUser.reservedAccount = response.responseBody;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      return response.responseBody;
    }
    
    throw new Error(response?.responseMessage || 'Failed to create reserved account');
  } catch (error) {
    console.error('Error creating reserved account:', error);
    throw error;
  }
};

// Get a user's reserved account details
export const getUserReservedAccount = async (params: {
  email: string;
  name: string;
  isPermanent?: boolean;
}): Promise<any> => {
  // This would typically make an API call to fetch the user's virtual account
  // For now, we'll just return the current user's reserved account if it exists
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (currentUser && currentUser.reservedAccount) {
      return {
        requestSuccessful: true,
        responseMessage: 'Virtual account retrieved successfully',
        responseBody: currentUser.reservedAccount
      };
    }
    
    // If no account exists, we'd typically make an API call here
    throw new Error('No reserved account found');
  } catch (error) {
    console.error('Error getting reserved account:', error);
    throw error;
  }
};

// Create a virtual account using Flutterwave Edge Function
export const createVirtualAccount = async (params: {
  email: string;
  name: string;
  bvn?: string;
  nin?: string;
  amount?: number;
  isPermanent?: boolean;
  narration?: string;
}) => {
  try {
    // Call our Supabase Edge Function that interfaces with Flutterwave
    const response = await fetch('https://nvinapqmcmbpyjpwpgms.supabase.co/functions/v1/flutterwave-api/create-virtual-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: params.email,
        is_permanent: params.isPermanent,
        bvn: params.bvn,
        nin: params.nin,
        tx_ref: `VA_${Date.now()}_${uuidv4().slice(0, 8)}`,
        narration: params.narration || `Virtual account for ${params.name}`,
        currency: 'NGN',
        amount: params.amount
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error creating virtual account:', error);
    throw error;
  }
};

// Get transactions for a reserved account
export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    // Call our Supabase Edge Function that interfaces with Flutterwave
    const response = await fetch(`https://nvinapqmcmbpyjpwpgms.supabase.co/functions/v1/flutterwave-api/get-transactions?account_reference=${accountReference}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.status === 'success' && Array.isArray(result.data)) {
      // Process transactions and add them to localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      result.data.forEach((tx: any) => {
        // Create transaction record
        const transaction = {
          contributionId: '',
          userId: currentUser.id,
          type: 'deposit',
          amount: tx.amount,
          description: tx.narration || 'Bank transfer deposit',
          status: 'completed',
          referenceId: tx.flw_ref,
          paymentMethod: 'bank_transfer',
          updated_at: new Date().toISOString(),
          anonymous: false,
          metadata: {
            accountNumber: tx.account_number,
            accountReference: accountReference,
            senderName: tx.full_name || tx.meta?.senderName,
            senderBank: tx.meta?.bankName,
            transactionReference: tx.flw_ref
          }
        };
        
        createTransaction(transaction);
        
        // Update user balance
        if (currentUser.id) {
          const users = JSON.parse(localStorage.getItem('users') || '[]');
          const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
          
          if (userIndex >= 0) {
            users[userIndex].walletBalance = (users[userIndex].walletBalance || 0) + tx.amount;
            localStorage.setItem('users', JSON.stringify(users));
            
            // Update current user
            currentUser.walletBalance = (currentUser.walletBalance || 0) + tx.amount;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
          }
        }
      });
      
      return result.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
};

// Create a payment invoice for card payments
export const createPaymentInvoice = async (params: PaymentInvoiceParams): Promise<PaymentInvoiceResult> => {
  try {
    // Generate a unique reference
    const txRef = `INV_${Date.now()}_${uuidv4().slice(0, 8)}`;
    
    // Call our Supabase Edge Function that interfaces with Flutterwave
    const response = await fetch('https://nvinapqmcmbpyjpwpgms.supabase.co/functions/v1/flutterwave-api/payment-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: params.amount,
        currency: 'NGN',
        redirect_url: params.redirectUrl || window.location.origin + '/payment-callback',
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        title: 'CollectiPay Wallet Top Up',
        description: params.description || 'Fund your wallet',
        meta: {
          userId: params.userId
        }
      })
    });

    const result = await response.json();
    
    if (result.status === 'success') {
      return {
        checkoutUrl: result.data.link,
        reference: txRef,
        status: 'success'
      };
    }
    
    return {
      error: result.message || 'Failed to create payment invoice',
      status: 'error'
    };
  } catch (error) {
    console.error('Error creating payment invoice:', error);
    return {
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      status: 'error'
    };
  }
};
