
import axios from 'axios';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { addWalletTransaction } from '@/services/wallet/transactions';
import { createTransaction } from '@/services/localStorage';
import { Transaction } from '@/services/localStorage/types';

// Add a function to handle Monnify payment
export const payWithMonnify = (options: {
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
}) => {
  const { amount, user, contribution, anonymous = false, onSuccess, onClose } = options;
  
  // Create a payment reference
  const paymentReference = `MONNIFY_${Date.now()}`;
  
  // Mock the payment process for now since we're not calling a real API
  console.log("Processing payment with Monnify:", { amount, user, contribution, anonymous });
  
  // Create a transaction object to simulate successful payment
  const transaction: Transaction = {
    id: uuidv4(),
    userId: user.id,
    contributionId: contribution?.id || '',
    type: "deposit",
    amount: amount,
    status: 'completed',
    description: contribution ? `Contribution to ${contribution.name}` : 'Wallet deposit',
    paymentMethod: 'card',
    reference: paymentReference,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metaData: {
      customerEmail: user.email,
      customerName: user.name,
      contributionName: contribution?.name,
      anonymous: anonymous
    }
  };
  
  // Simulate a successful transaction
  setTimeout(() => {
    try {
      // Add transaction to wallet
      addWalletTransaction(transaction);
      
      // Also create a transaction record in localStorage
      createTransaction({
        userId: user.id,
        type: 'deposit',
        amount: amount,
        description: contribution ? `Contribution to ${contribution.name}` : 'Wallet deposit',
        paymentMethod: 'card',
        reference: paymentReference,
      });
      
      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess({ transaction, paymentReference });
      }
    } catch (error) {
      console.error('Error processing mock payment:', error);
      toast.error('Failed to process payment');
    }
  }, 1500);
  
  // Simulate payment window closure after a delay
  setTimeout(() => {
    if (onClose) {
      onClose();
    }
  }, 3000);
};

// Function to initialize a Monnify payment
export const initializeMonnifyPayment = async (paymentDetails: any) => {
  try {
    const response = await axios.post('/api/monnify/initialize', paymentDetails);
    return response.data;
  } catch (error) {
    console.error("Error initializing Monnify payment:", error);
    toast.error("Failed to initialize payment");
    return null;
  }
};

// Function to verify a Monnify transaction
export const verifyMonnifyTransaction = async (transactionReference: string) => {
  try {
    const response = await axios.get(`/api/monnify/verify?transactionReference=${transactionReference}`);
    return response.data;
  } catch (error) {
    console.error("Error verifying Monnify transaction:", error);
    toast.error("Failed to verify transaction");
    return null;
  }
};

// Function to handle Monnify payment callback
export const processPaymentCallback = (invoiceData: any, onSuccess: () => void, onError: () => void) => {
  try {
    // Use reference instead of paymentReference
    const paymentReference = invoiceData.reference || invoiceData.paymentReference;
    
    if (!paymentReference) {
      console.error("No payment reference found in invoice data", invoiceData);
      onError();
      return;
    }
    
    // Extract relevant data from the invoice
    const {
      amountPaid,
      customer: {
        email: customerEmail,
        name: customerName
      },
      paymentStatus,
      paymentMethod,
      transactionReference,
      invoiceReference
    } = invoiceData;
    
    // Check if payment was successful
    if (paymentStatus === 'PAID') {
      // Create a transaction object
      const transaction: Transaction = {
        id: uuidv4(),
        userId: invoiceData.customer.userId, 
        contributionId: invoiceData.customer.contributionId || '', 
        type: "deposit",
        amount: amountPaid,
        status: 'completed',
        description: `Payment via Monnify - Invoice ${invoiceReference}`,
        paymentMethod: paymentMethod,
        reference: transactionReference,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metaData: {
          customerEmail,
          customerName,
          transactionReference,
          invoiceReference
        }
      };
      
      // Add the transaction to localStorage
      addWalletTransaction(transaction);
      
      // Also create a transaction record in localStorage
      createTransaction({
        userId: invoiceData.customer.userId,
        type: 'deposit',
        amount: amountPaid,
        description: `Payment via Monnify - Invoice ${invoiceReference}`,
        paymentMethod: paymentMethod,
        reference: transactionReference,
      });
      
      // Log success
      console.log("Payment processed successfully for reference:", paymentReference);
      toast.success("Payment successful!");
      
      // Call onSuccess callback
      onSuccess();
    } else {
      // Log failure
      console.error("Payment failed for reference:", paymentReference);
      toast.error("Payment failed. Please try again.");
      
      // Call onError callback
      onError();
    }
  } catch (error) {
    console.error("Error processing payment callback:", error);
    onError();
  }
};
