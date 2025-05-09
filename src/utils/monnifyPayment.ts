import axios from 'axios';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { addWalletTransaction } from '@/services/wallet/transactions';
import { createTransaction } from '@/services/localStorage';

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
      const transaction = {
        id: uuidv4(),
        userId: invoiceData.customer.userId, // Assuming userId is passed in customer object
        contributionId: invoiceData.customer.contributionId || '', // Assuming contributionId is passed in customer object
        type: 'deposit',
        amount: amountPaid,
        status: 'completed',
        description: `Payment via Monnify - Invoice ${invoiceReference}`,
        paymentMethod: paymentMethod,
        referenceId: transactionReference,
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
        referenceId: transactionReference,
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
