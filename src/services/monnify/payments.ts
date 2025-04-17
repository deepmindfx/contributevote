
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
    
    // If contributionId is provided, include account reference in request
    if (data.contributionId && data.contributionAccountReference) {
      data.incomeSplitConfig = [{
        subAccountCode: data.contributionAccountReference,
        feePercentage: 100, // Send 100% of the payment to the contribution account
        splitAmount: data.amount,
        feeBearer: false
      }];
      console.log("Adding split configuration for contribution account:", data.contributionAccountReference);
    }
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    const response = await fetch(`${BASE_URL}/api/v1/invoice/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
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
