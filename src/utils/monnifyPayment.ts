
// This file maintains compatibility with the old Monnify API but now uses Flutterwave
// for backend operations. The interface is kept the same to avoid changing the rest of the app.
import { createPaymentInvoice } from '@/services/walletIntegration';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface IMonnifyPaymentOptions {
  amount: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  contribution?: {
    id: string;
    name: string;
    accountReference?: string;
  };
  anonymous?: boolean;
  onSuccess?: (response: any) => void;
  onClose?: () => void;
}

interface MonnifyWindow extends Window {
  MonnifySDK?: {
    initialize: (config: any) => void;
  };
}

declare const window: MonnifyWindow;

export const payWithMonnify = async (options: IMonnifyPaymentOptions) => {
  try {
    console.log("Starting payment with options:", options);
    
    const {
      amount,
      user,
      contribution,
      anonymous = false,
      onSuccess,
      onClose
    } = options;
    
    // Generate a reference for this payment
    const reference = `TX-${uuidv4()}`;
    
    // Create a payment invoice using our service
    const invoiceResult = await createPaymentInvoice({
      amount,
      description: contribution 
        ? `Contribution to ${contribution.name}`
        : `Wallet funding for ${user.name}`,
      customerEmail: user.email,
      customerName: user.name,
      userId: user.id
    });
    
    if (!invoiceResult) {
      toast.error("Payment initialization failed");
      return;
    }
    
    console.log("Invoice created:", invoiceResult);
    
    // Simulate payment with a mock window
    const mockMonnify = {
      initialize: (config: any) => {
        console.log("Mock payment initialized with config:", config);
        
        // Auto-contribute if this is for a contribution
        if (contribution) {
          // Load existing transactions from localStorage
          const transactionsStr = localStorage.getItem('transactions');
          const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
          
          // Create a new transaction for this contribution
          const newTransaction = {
            id: reference,
            userId: user.id,
            amount,
            type: 'contribution',
            status: 'completed',
            description: `Contribution to ${contribution.name}`,
            referenceId: invoiceResult.invoiceReference,
            accountReference: contribution.accountReference,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            contributionId: contribution.id,
            paymentMethod: 'card',
            isAnonymous: anonymous,
            userDetails: {
              name: user.name,
              email: user.email
            }
          };
          
          // Add the transaction to the array
          transactions.push(newTransaction);
          
          // Save back to localStorage
          localStorage.setItem('transactions', JSON.stringify(transactions));
          
          console.log("Auto-contribution transaction created:", newTransaction);
          
          // Update the contribution stats
          const contributionsStr = localStorage.getItem('contributions');
          const contributions = contributionsStr ? JSON.parse(contributionsStr) : [];
          
          const updatedContributions = contributions.map((c: any) => {
            if (c.id === contribution.id) {
              return {
                ...c,
                currentAmount: (c.currentAmount || 0) + amount,
                transactions: [...(c.transactions || []), reference],
                contributors: c.contributors ? 
                  (c.contributors.includes(user.id) ? c.contributors : [...c.contributors, user.id]) : 
                  [user.id]
              };
            }
            return c;
          });
          
          localStorage.setItem('contributions', JSON.stringify(updatedContributions));
        } else {
          // This is a wallet funding operation
          // Load existing users from localStorage
          const usersStr = localStorage.getItem('users');
          const users = usersStr ? JSON.parse(usersStr) : [];
          
          // Update user wallet balance
          const updatedUsers = users.map((u: any) => {
            if (u.id === user.id) {
              return {
                ...u,
                walletBalance: (u.walletBalance || 0) + amount
              };
            }
            return u;
          });
          
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          
          // Add wallet funding transaction
          const transactionsStr = localStorage.getItem('transactions');
          const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
          
          const newTransaction = {
            id: reference,
            userId: user.id,
            amount,
            type: 'deposit',
            status: 'completed',
            description: `Wallet funding for ${user.name}`,
            referenceId: invoiceResult.invoiceReference,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            paymentMethod: 'card'
          };
          
          transactions.push(newTransaction);
          localStorage.setItem('transactions', JSON.stringify(transactions));
        }
        
        // Call success callback
        if (onSuccess) {
          onSuccess({
            transactionReference: reference,
            paidAmount: amount
          });
        }
        
        // Call close callback
        if (onClose) {
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      }
    };
    
    // Set up the mock Monnify SDK
    window.MonnifySDK = mockMonnify;
    
    // Call the mock initialize method
    window.MonnifySDK.initialize({
      amount,
      currency: "NGN",
      reference,
      customerName: user.name,
      customerEmail: user.email,
      apiKey: "MK_TEST_XXXXXXXXX",
      contractCode: "XXXXXXXXXX",
      paymentDescription: contribution 
        ? `Contribution to ${contribution.name}`
        : `Wallet funding for ${user.name}`,
      isTestMode: true,
      metadata: {
        userId: user.id,
        contributionId: contribution?.id || null,
        anonymous: anonymous || false
      },
      onComplete: (response: any) => {
        if (onSuccess) onSuccess(response);
      },
      onClose: () => {
        if (onClose) onClose();
      }
    });
    
  } catch (error) {
    console.error("Error in payWithMonnify:", error);
    toast.error("Payment initialization failed");
  }
};
