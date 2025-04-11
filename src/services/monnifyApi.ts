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

/**
 * Initiate a transfer to a bank account
 * @param data Transfer data
 * @returns Response with transfer details
 */
export const initiateTransfer = async (data: {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency: string;
  sourceAccountNumber: string;
  async?: boolean;
}) => {
  try {
    console.log("Initiating transfer with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        success: false, 
        message: "Failed to authenticate with payment provider",
        requestSuccessful: false
      };
    }
    
    console.log("Sending transfer request...");
    const response = await fetch(`${BASE_URL}/api/v2/disbursements/single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText || "Unknown error" };
      }
      
      console.error("Transfer request failed:", errorData);
      return { 
        success: false, 
        message: errorData.responseMessage || `Failed to initiate transfer: ${response.status}`,
        requestSuccessful: false
      };
    }
    
    const responseData = await response.json();
    
    if (!responseData.requestSuccessful) {
      console.error("Transfer request failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to initiate transfer",
        requestSuccessful: false
      };
    }
    
    console.log("Transfer initiated successfully:", responseData);
    return {
      ...responseData,
      success: true
    };
  } catch (error) {
    console.error("Error initiating transfer:", error);
    return { 
      success: false, 
      message: "Unable to connect to payment provider",
      requestSuccessful: false
    };
  }
};

/**
 * Get list of supported banks
 * @returns List of banks
 */
export const getBanks = async () => {
  try {
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        success: false, 
        message: "Failed to authenticate with payment provider",
        banks: []
      };
    }
    
    console.log("Fetching banks list...");
    const response = await fetch(`${BASE_URL}/api/v1/banks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
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
      
      console.error("Failed to fetch banks:", errorData);
      return { 
        success: false, 
        message: errorData.responseMessage || `Failed to fetch banks: ${response.status}`,
        banks: []
      };
    }
    
    const responseData = await response.json();
    
    if (!responseData.requestSuccessful) {
      console.error("Failed to fetch banks:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to fetch banks",
        banks: []
      };
    }
    
    return {
      success: true,
      banks: responseData.responseBody || []
    };
  } catch (error) {
    console.error("Error fetching banks:", error);
    return { 
      success: false, 
      message: "Unable to connect to payment provider",
      banks: []
    };
  }
};

/**
 * Verify bank account details
 * @param accountNumber The account number to verify
 * @param bankCode The bank code
 * @returns Account verification result
 */
export const verifyBankAccount = async (accountNumber: string, bankCode: string) => {
  try {
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        success: false, 
        message: "Failed to authenticate with payment provider"
      };
    }
    
    console.log(`Verifying account number ${accountNumber} with bank code ${bankCode}...`);
    const response = await fetch(`${BASE_URL}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
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
      
      console.error("Account verification failed:", errorData);
      return { 
        success: false, 
        message: errorData.responseMessage || `Failed to verify account: ${response.status}`
      };
    }
    
    const responseData = await response.json();
    
    if (!responseData.requestSuccessful) {
      console.error("Account verification failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to verify account"
      };
    }
    
    console.log("Account verification successful:", responseData);
    return {
      success: true,
      accountName: responseData.responseBody?.accountName,
      accountNumber: responseData.responseBody?.accountNumber,
      bankCode: responseData.responseBody?.bankCode,
      bankName: responseData.responseBody?.bankName
    };
  } catch (error) {
    console.error("Error verifying account:", error);
    return { 
      success: false, 
      message: "Unable to connect to payment provider"
    };
  }
};
