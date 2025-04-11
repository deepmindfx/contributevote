
import { v4 as uuidv4 } from "uuid";
import {
  getCurrentUser,
  getAllTransactions,
  updateUserById,
  addTransaction
} from "../localStorage";
import { CardTokenData, PaymentResponse } from "./types";

/**
 * Function to tokenize a card for future payments
 * @param cardDetails
 * @returns Promise<CardTokenData>
 */
export const tokenizeCard = async (cardDetails: {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardName: string;
}): Promise<CardTokenData> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // In a real app, this would call a payment gateway API
  const tokenData: CardTokenData = {
    last4: cardDetails.cardNumber.slice(-4),
    expMonth: cardDetails.expiryMonth,
    expYear: cardDetails.expiryYear,
    cardType: getCardType(cardDetails.cardNumber),
    token: `tok_${Math.random().toString(36).substring(2, 15)}`,
    default: false,
    createdAt: new Date().toISOString()
  };
  
  // Save to user's card tokens
  const currentUser = getCurrentUser();
  if (currentUser) {
    const cardTokens = currentUser.cardTokens || [];
    // Set as default if it's the first card
    if (cardTokens.length === 0) {
      tokenData.default = true;
    }
    
    updateUserById(currentUser.id, {
      cardTokens: [...cardTokens, tokenData]
    });
  }
  
  return tokenData;
};

/**
 * Function to charge a tokenized card
 * @param amount - Amount to charge in NGN
 * @param token - Card token
 * @param saveCard - Whether to save the card for future use
 * @returns Promise<PaymentResponse>
 */
export const chargeCard = async (
  amount: number,
  token: string,
  saveCard: boolean = false
): Promise<PaymentResponse> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock success response (95% success rate)
  const isSuccessful = Math.random() > 0.05;
  
  const transactionReference = `txn_${Math.random().toString(36).substring(2, 10)}`;
  
  if (isSuccessful) {
    // Update user's wallet balance
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Update user balance
      updateUserById(currentUser.id, {
        walletBalance: currentUser.walletBalance + amount
      });
      
      // Record the transaction
      addTransaction({
        userId: currentUser.id,
        contributionId: "", // No specific contribution
        amount: amount,
        type: "deposit",
        status: "completed",
        createdAt: new Date().toISOString(),
        description: "Card Deposit",
        metaData: {
          paymentMethod: "card",
          cardLast4: token.slice(-4),
          reference: transactionReference
        }
      });
    }
    
    return {
      status: "success",
      message: "Payment successful",
      data: {
        reference: transactionReference,
        amount,
        date: new Date().toISOString(),
      }
    };
  } else {
    // Payment failed
    return {
      status: "failed",
      message: "Payment failed. Please try again or use a different payment method.",
      data: null
    };
  }
};

/**
 * Function to transfer money to a bank account
 * @param amount - Amount to transfer
 * @param bankDetails - Bank account details
 * @returns Promise<PaymentResponse>
 */
export const transferToBank = async (
  amount: number,
  bankDetails: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  }
): Promise<PaymentResponse> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  // Mock success response (90% success rate)
  const isSuccessful = Math.random() > 0.1;
  
  const transactionReference = `wdr_${Math.random().toString(36).substring(2, 10)}`;
  
  if (isSuccessful) {
    // Update user's wallet balance
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Check if user has sufficient balance
      if (currentUser.walletBalance < amount) {
        return {
          status: "failed",
          message: "Insufficient funds",
          data: null
        };
      }
      
      // Update user balance
      updateUserById(currentUser.id, {
        walletBalance: currentUser.walletBalance - amount
      });
      
      // Record the transaction
      addTransaction({
        userId: currentUser.id,
        contributionId: "", // No specific contribution
        amount: amount,
        type: "withdrawal",
        status: "completed",
        createdAt: new Date().toISOString(),
        description: "Bank Withdrawal",
        metaData: {
          paymentMethod: "bank_transfer",
          bankName: getBankName(bankDetails.bankCode),
          accountNumber: bankDetails.accountNumber,
          reference: transactionReference
        }
      });
    }
    
    return {
      status: "success",
      message: "Transfer successful",
      data: {
        reference: transactionReference,
        amount,
        date: new Date().toISOString(),
      }
    };
  } else {
    // Transfer failed
    return {
      status: "failed",
      message: "Transfer failed. Please try again later.",
      data: null
    };
  }
};

/**
 * Function to create a payment invoice
 * @param invoiceData 
 * @returns Promise with invoice data
 */
export const createPaymentInvoice = async (invoiceData: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  userId: string;
}): Promise<any> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create mock invoice
  const invoice = {
    invoiceReference: `inv_${Math.random().toString(36).substring(2, 10)}`,
    description: invoiceData.description,
    amount: invoiceData.amount,
    currencyCode: "NGN",
    status: "pending",
    customerEmail: invoiceData.customerEmail,
    customerName: invoiceData.customerName,
    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    redirectUrl: window.location.origin + "/dashboard",
    checkoutUrl: `${window.location.origin}/pay-invoice?amount=${invoiceData.amount}&reference=${Math.random().toString(36).substring(2, 10)}`,
    createdOn: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    contributionId: ""
  };
  
  // Store invoice
  const currentUser = getCurrentUser();
  if (currentUser) {
    const invoices = currentUser.invoices || [];
    updateUserById(currentUser.id, {
      invoices: [...invoices, invoice]
    });
  }
  
  return invoice;
};

/**
 * Function to simulate receiving payment from an external source
 * This would be called by a webhook in a real app
 * @param userId 
 * @param amount 
 * @param source 
 * @param reference 
 */
export const simulateIncomingPayment = (
  userId: string,
  amount: number,
  source: string = "bank_transfer",
  reference: string = `ref_${Math.random().toString(36).substring(2, 10)}`
) => {
  try {
    // Update user balance - Use a number value directly, not a function
    const user = getCurrentUser();
    if (user) {
      updateUserById(userId, {
        walletBalance: user.walletBalance + amount
      });
    }
    
    // Record the transaction
    addTransaction({
      userId,
      contributionId: "", // No specific contribution
      amount,
      type: "deposit", // This needs to match with the Transaction type in localStorage.ts
      status: "completed", // This needs to match with the Transaction type in localStorage.ts
      createdAt: new Date().toISOString(),
      description: `Deposit via ${source}`,
      metaData: {
        paymentMethod: source,
        reference
      }
    });
    
    // Return the transaction reference
    return reference;
  } catch (error) {
    console.error("Error simulating incoming payment:", error);
    return null;
  }
};

/**
 * Helper function to get card type based on card number
 * @param cardNumber 
 * @returns string
 */
const getCardType = (cardNumber: string): string => {
  // Basic regex patterns to identify card types
  const patterns = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
    verve: /^506/
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(cardNumber)) {
      return type;
    }
  }
  
  return "unknown";
};

/**
 * Helper function to get bank name based on bank code
 * @param bankCode 
 * @returns string
 */
const getBankName = (bankCode: string): string => {
  // In a real app, this would be a comprehensive list of bank codes
  const bankCodes: Record<string, string> = {
    "011": "First Bank",
    "057": "Zenith Bank",
    "058": "GTBank",
    "221": "Stanbic IBTC",
    "033": "UBA",
    "050": "EcoBank",
    "044": "Access Bank",
    "070": "Fidelity Bank",
    "032": "Union Bank",
    "068": "Standard Chartered"
  };
  
  return bankCodes[bankCode] || "Unknown Bank";
};

// Export the default objects
export default {
  tokenizeCard,
  chargeCard,
  transferToBank,
  simulateIncomingPayment,
  createPaymentInvoice
};
