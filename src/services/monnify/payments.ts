
import { BASE_URL, CONTRACT_CODE } from './config';
import { getAuthToken } from './auth';

/**
 * Create a Monnify invoice
 * @param data Invoice creation data
 * @returns Response with invoice details
 */
export const createInvoice = async (data: any) => {
  try {
    console.log("Creating invoice with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    // Add contract code if not provided
    const invoiceData = {
      contractCode: CONTRACT_CODE,
      ...data
    };
    
    const response = await fetch(`${BASE_URL}/api/v1/invoice/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to create invoice:", errorData);
      throw new Error(errorData.responseMessage || `Failed to create invoice: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
};

/**
 * Charge a Monnify card token
 * @param data Card token charging data
 * @returns Response with payment details
 */
export const chargeCardToken = async (data: any) => {
  try {
    console.log("Charging card token with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      throw new Error("Failed to authenticate with payment provider");
    }
    
    const response = await fetch(`${BASE_URL}/api/v1/payments/charge-card-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to charge card token:", errorData);
      throw new Error(errorData.responseMessage || `Failed to charge card token: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error charging card token:", error);
    throw error;
  }
};

/**
 * Create a direct payment to a specific account
 * @param data Payment data including account reference
 * @returns Response with payment details
 */
export const createDirectPayment = async (data: {
  amount: number,
  customerName: string,
  customerEmail: string,
  paymentDescription: string,
  paymentReference: string,
  accountReference: string,
  metadata?: any
}) => {
  try {
    console.log("Creating direct payment with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    // Format the payment data with necessary fields
    const paymentData = {
      amount: data.amount,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      paymentDescription: data.paymentDescription,
      paymentReference: data.paymentReference,
      currencyCode: "NGN",
      contractCode: CONTRACT_CODE,
      accountReference: data.accountReference,
      metadata: data.metadata || {},
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"]
    };
    
    const response = await fetch(`${BASE_URL}/api/v1/merchant/transactions/init-transaction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to create direct payment:", errorData);
      throw new Error(errorData.responseMessage || `Failed to create direct payment: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating direct payment:", error);
    throw error;
  }
};
