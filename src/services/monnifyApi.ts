
// Monnify API service for handling virtual account operations

// Base URL for Monnify API 
const BASE_URL = 'https://sandbox.monnify.com';

/**
 * Get authentication token for API access
 * @returns Auth token for subsequent API calls
 */
export const getAuthToken = async () => {
  try {
    const apiKey = "YOUR_API_KEY"; 
    const secretKey = "YOUR_SECRET_KEY";
    
    // Encode API credentials
    const credentials = btoa(`${apiKey}:${secretKey}`);
    
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.responseBody.accessToken;
  } catch (error) {
    console.error("Error getting auth token:", error);
    throw error;
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
    
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create reserved account: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating reserved account:", error);
    throw error;
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
    
    const response = await fetch(`${BASE_URL}/api/v2/bank-transfer/reserved-accounts/${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get reserved account details: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error getting reserved account details:", error);
    throw error;
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
    
    const response = await fetch(`${BASE_URL}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=${accountReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get reserved account transactions: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error getting reserved account transactions:", error);
    throw error;
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
