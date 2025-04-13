
// Monnify API service for handling virtual account operations

// Base URL for Monnify API 
const BASE_URL = 'https://api.monnify.com';

/**
 * Get authentication token for API access
 * @returns Auth token for subsequent API calls
 */
export const getAuthToken = async () => {
  try {
    const apiKey = "MK_PROD_XR897H4H43"; 
    const secretKey = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9";
    
    // Encode API credentials with proper encoding
    const credentials = btoa(`${apiKey}:${secretKey}`);
    
    console.log("Attempting to authenticate with Monnify...");
    
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText || "Unknown error" };
      }
      console.error("Authentication error details:", errorData);
      throw new Error(`Authentication failed: ${response.status} - ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.requestSuccessful || !data.responseBody?.accessToken) {
      console.error("Auth response missing token:", data);
      throw new Error("Invalid authentication response from server");
    }
    
    console.log("Authentication successful");
    return data.responseBody.accessToken;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

/**
 * Create a reserved account for a customer
 * @param data Account creation data
 * @returns Response with account details
 */
export const createReservedAccount = async (data: any) => {
  try {
    console.log("Creating reserved account with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    console.log("Sending account creation request...");
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Reserved account creation failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || `Failed to create reserved account: ${response.status}`
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Reserved account creation failed with error:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to create reserved account" 
      };
    }
    
    console.log("Account creation successful:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error creating reserved account:", error);
    return { success: false, message: "Unable to connect to payment provider" };
  }
};

/**
 * Create a reserved account for a contribution group
 * @param data Account creation data for the group
 * @returns Response with account details
 */
export const createContributionGroupAccount = async (data: {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  customerBvn: string;
}) => {
  try {
    console.log("Creating contribution group account with data:", data);
    
    // Use the same createReservedAccount function but with group-specific data
    const response = await createReservedAccount({
      ...data,
      // Make sure the account name indicates it's a contribution group
      accountName: `CollectiPay - ${data.accountName}`,
      preferredBanks: ["035"], // Use the same bank as personal accounts for consistency
    });
    
    return response;
  } catch (error) {
    console.error("Error creating contribution group account:", error);
    return { success: false, message: "Unable to create account for the contribution group" };
  }
};

/**
 * Get reserved account details
 * @param accountReference Account reference
 * @returns Response with account details
 */
export const getReservedAccountDetails = async (accountReference: string) => {
  try {
    console.log("Getting reserved account details for:", accountReference);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    console.log("Sending request for account details...");
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts/${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Failed to get account details:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || `Failed to get reserved account details: ${response.status}` 
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Account details request failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to get reserved account details" 
      };
    }
    
    console.log("Account details retrieved successfully");
    return responseData;
  } catch (error) {
    console.error("Error getting reserved account details:", error);
    return { success: false, message: "Unable to connect to payment provider" };
  }
};

/**
 * Get reserved account transactions
 * @param accountReference Account reference
 * @returns Response with transactions
 */
export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    console.log("Getting reserved account transactions for:", accountReference);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        requestSuccessful: false, 
        responseMessage: "Failed to authenticate with payment provider",
        responseBody: { content: [] } 
      };
    }
    
    console.log("Sending request for transactions...");
    const response = await fetch(`${BASE_URL}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Failed to get transactions:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || `Failed to get reserved account transactions: ${response.status}`,
        responseBody: { content: [] } 
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Transactions request failed:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || "Failed to get transactions",
        responseBody: { content: [] } 
      };
    }
    
    console.log("Transactions retrieved successfully:", 
      responseData.responseBody?.content?.length || 0, "transactions found");
    return responseData;
  } catch (error) {
    console.error("Error getting reserved account transactions:", error);
    // Return an empty successful response instead of error to prevent UI disruption
    return { 
      requestSuccessful: false, 
      responseMessage: "Failed to fetch transactions. Please try again.",
      responseBody: { content: [] } 
    };
  }
};

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
    
    const response = await fetch(`${BASE_URL}/api/v1/invoice/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.status}`);
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
    
    const response = await fetch(`${BASE_URL}/api/v1/payments/charge-card-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to charge card token: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error charging card token:", error);
    throw error;
  }
};
