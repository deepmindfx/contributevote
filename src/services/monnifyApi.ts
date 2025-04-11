
// Monnify API service for handling virtual account operations

// Base URL for Monnify API 
const BASE_URL = 'https://api.monnify.com';

/**
 * Get authentication token for API access
 * @returns Auth token for subsequent API calls
 */
export const getAuthToken = async () => {
  try {
    // Production credentials
    const apiKey = "MK_PROD_XR897H4H43"; 
    const secretKey = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9";
    
    // Encode API credentials with proper encoding
    const credentials = btoa(`${apiKey}:${secretKey}`);
    
    console.log("Authenticating with Monnify using production credentials...");
    
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
 * Initiate an async bank transfer (disbursement)
 * @param data Transfer data
 * @returns Response with transfer details
 */
export const initiateAsyncTransfer = async (data: {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency: string;
  sourceAccountNumber: string;
  async: boolean;
}) => {
  try {
    console.log("Initiating async transfer with data:", data);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        requestSuccessful: false, 
        responseMessage: "Failed to authenticate with payment provider",
        responseCode: "AUTH_FAILED"
      };
    }
    
    console.log("Sending async transfer request...");
    
    // Make the API call
    const response = await fetch(`${BASE_URL}/api/v2/disbursements/single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const responseText = await response.text();
    console.log("Raw response:", responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response:", e);
      return {
        requestSuccessful: false,
        responseMessage: "Invalid response from payment provider",
        responseCode: "PARSE_ERROR"
      };
    }
    
    console.log("Parsed response data:", responseData);
    
    if (!response.ok) {
      console.error("Async transfer failed with HTTP error:", response.status, responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || `Failed to initiate transfer: ${response.status}`,
        responseCode: responseData.responseCode || "HTTP_ERROR"
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Async transfer failed with API error:", responseData);
      return responseData;
    }
    
    console.log("Async transfer initiated successfully:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error initiating async transfer:", error);
    return { 
      requestSuccessful: false, 
      responseMessage: "Unable to connect to payment provider",
      responseCode: "CONNECTION_ERROR"
    };
  }
};

/**
 * Get bank name by bank code
 * @param code Bank code
 * @returns Bank name or code if not found
 */
function getBankNameByCode(code: string): string {
  const BANKS = [
    { code: "044", name: "Access Bank" },
    { code: "063", name: "Access Bank (Diamond)" },
    { code: "035A", name: "ALAT by WEMA" },
    { code: "401", name: "ASO Savings and Loans" },
    { code: "50931", name: "Bowen Microfinance Bank" },
    { code: "50823", name: "CEMCS Microfinance Bank" },
    { code: "023", name: "Citibank Nigeria" },
    { code: "050", name: "Ecobank Nigeria" },
    { code: "562", name: "Ekondo Microfinance Bank" },
    { code: "070", name: "Fidelity Bank" },
    { code: "011", name: "First Bank of Nigeria" },
    { code: "214", name: "First City Monument Bank" },
    { code: "058", name: "Guaranty Trust Bank" },
    { code: "030", name: "Heritage Bank" },
    { code: "301", name: "Jaiz Bank" },
    { code: "082", name: "Keystone Bank" },
    { code: "50211", name: "Kuda Bank" },
    { code: "90052", name: "Moniepoint Microfinance Bank" },
    { code: "100002", name: "Opay" },
    { code: "100003", name: "Palmpay" },
    { code: "526", name: "Parallex Bank" },
    { code: "076", name: "Polaris Bank" },
    { code: "101", name: "Providus Bank" },
    { code: "221", name: "Stanbic IBTC Bank" },
    { code: "068", name: "Standard Chartered Bank" },
    { code: "232", name: "Sterling Bank" },
    { code: "100", name: "Suntrust Bank" },
    { code: "102", name: "Titan Bank" },
    { code: "032", name: "Union Bank of Nigeria" },
    { code: "033", name: "United Bank For Africa" },
    { code: "215", name: "Unity Bank" },
    { code: "035", name: "Wema Bank" },
    { code: "057", name: "Zenith Bank" }
  ];
  
  const bank = BANKS.find(b => b.code === code);
  return bank ? bank.name : code;
}

/**
 * Check status of a transfer
 * @param reference Transfer reference
 * @returns Response with transfer status
 */
export const checkTransferStatus = async (reference: string) => {
  try {
    console.log("Checking transfer status for reference:", reference);
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { 
        requestSuccessful: false, 
        responseMessage: "Failed to authenticate with payment provider"
      };
    }
    
    console.log("Sending transfer status request...");
    const response = await fetch(`${BASE_URL}/api/v2/disbursements/single/summary?reference=${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    console.log("Transfer status response:", responseData);
    
    if (!response.ok) {
      console.error("Failed to get transfer status:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || `Failed to get transfer status: ${response.status}` 
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Transfer status request failed:", responseData);
      return { 
        requestSuccessful: false, 
        responseMessage: responseData.responseMessage || "Failed to get transfer status" 
      };
    }
    
    console.log("Transfer status retrieved successfully");
    return responseData;
  } catch (error) {
    console.error("Error getting transfer status:", error);
    return { 
      requestSuccessful: false, 
      responseMessage: "Unable to connect to payment provider" 
    };
  }
};
