
import { BASE_URL, CONTRACT_CODE } from './config';
import { getAuthToken } from './auth';
import { toast } from 'sonner';

/**
 * Create a Monnify invoice
 * @param data Invoice creation data
 * @returns Response with invoice details
 */
export const createInvoice = async (data: any) => {
  try {
    console.log("Creating invoice with data:", data);
    
    // Initialize request body
    const requestBody: any = {
      amount: data.amount,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      paymentDescription: data.description || "Payment",
      paymentReference: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
      currencyCode: "NGN",
      contractCode: CONTRACT_CODE,
      redirectUrl: window.location.origin,
    };
    
    // If contributionId is provided, include account reference in request
    if (data.contributionId && data.contributionAccountReference) {
      console.log("Adding split configuration for contribution account:", data.contributionAccountReference);
      
      requestBody.incomeSplitConfig = [{
        subAccountCode: data.contributionAccountReference,
        feePercentage: 0, // No fee percentage
        splitAmount: data.amount, // Send entire amount to contribution account
        feeBearer: false // Group doesn't bear the fee
      }];
      
      // Add the contribution details to the metadata
      requestBody.metaData = {
        ...requestBody.metaData,
        contributionId: data.contributionId,
        contributionName: data.contributionName || "Group Contribution",
        contributionAccountReference: data.contributionAccountReference
      };
    }
    
    // Get authentication token
    const token = await getAuthToken();
    
    console.log("Sending invoice creation request with body:", JSON.stringify(requestBody, null, 2));
    
    // Add debugging for token value (only show first and last 10 chars for security)
    console.log("Using auth token:", token.substring(0, 10) + "..." + token.substring(token.length - 10));
    
    const response = await fetch(`${BASE_URL}/api/v1/merchant/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // Log full response for debugging
    console.log("Invoice API response status:", response.status);
    
    const responseText = await response.text();
    console.log("Invoice API response text:", responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      throw new Error(`Invalid response from server: ${responseText}`);
    }
    
    if (!response.ok) {
      console.error("Failed to create invoice:", responseData);
      throw new Error(responseData.responseMessage || `Failed to create invoice: ${response.status}`);
    }
    
    // Check if request was successful
    if (!responseData.requestSuccessful) {
      console.error("Invoice creation failed with error:", responseData);
      throw new Error(responseData.responseMessage || "Failed to create invoice");
    }
    
    console.log("Invoice created successfully:", responseData);
    return responseData.responseBody;
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
    
    const response = await fetch(`${BASE_URL}/api/v1/payments/charge-card-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      throw new Error(`Invalid response from server: ${responseText}`);
    }
    
    if (!response.ok) {
      console.error("Failed to charge card token:", responseData);
      throw new Error(responseData.responseMessage || `Failed to charge card token: ${response.status}`);
    }
    
    // Check if request was successful
    if (!responseData.requestSuccessful) {
      console.error("Card token charging failed with error:", responseData);
      throw new Error(responseData.responseMessage || "Failed to charge card token");
    }
    
    console.log("Card token charged successfully:", responseData);
    return responseData.responseBody;
  } catch (error) {
    console.error("Error charging card token:", error);
    throw error;
  }
};
