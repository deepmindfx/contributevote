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
export const createContributionGroupAccount = async (firstName: string, lastName: string, contributionName: string) => {
  try {
    // Format the account name to include CollectiPay prefix
    const formattedAccountName = `CollectiPay - ${contributionName}`;
    console.log("Creating contribution group account with name:", formattedAccountName);
    
    // Prepare data for account creation
    const data = {
      accountReference: `CONTGROUP_${Date.now()}`,
      accountName: formattedAccountName,
      currencyCode: "NGN",
      contractCode: "465595618981",
      customerEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@collectipay.com`,
      customerName: `${firstName} ${lastName}`,
      customerBvn: "12345678901", // Default BVN for group accounts
      getAllAvailableBanks: true,
      preferredBanks: ["035"] // Default preferred bank
    };
    
    // Use the same createReservedAccount function but with group-specific data
    const response = await createReservedAccount(data);
    
    // If successful, extract the important account details from the response
    if (response.requestSuccessful && response.responseBody) {
      const accountDetails = {
        success: true,
        accountReference: response.responseBody.accountReference,
        accountName: response.responseBody.accountName,
        currencyCode: response.responseBody.currencyCode,
        accounts: response.responseBody.accounts,
        // For compatibility with existing code, add these fields too
        accountNumber: response.responseBody.accounts && response.responseBody.accounts.length > 0 
          ? response.responseBody.accounts[0].accountNumber : '',
        bankName: response.responseBody.accounts && response.responseBody.accounts.length > 0
          ? response.responseBody.accounts[0].bankName : 'Unknown Bank',
        reservedAccountType: response.responseBody.reservedAccountType,
        status: response.responseBody.status,
        createdOn: response.responseBody.createdOn,
        message: "Account created successfully"
      };
      
      console.log("Parsed account details for group:", accountDetails);
      return accountDetails;
    }
    
    return {
      success: false,
      message: response.responseMessage || "Failed to create account for the group"
    };
  } catch (error) {
    console.error("Error creating contribution group account:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unable to create account for the contribution group" 
    };
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
 * Create a payment invoice
 * @param amount Invoice amount
 * @param description Invoice description
 * @param customerEmail Customer email
 * @param customerName Customer name
 * @param userId Customer ID
 * @returns Response with invoice details
 */
export const createPaymentInvoice = async (
  amount: number, 
  description: string, 
  customerEmail: string, 
  customerName: string, 
  userId: string
) => {
  try {
    console.log("Creating payment invoice:", { amount, description, customerEmail, customerName, userId });
    
    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.error("Failed to authenticate with payment provider");
      return { success: false, message: "Failed to authenticate with payment provider" };
    }
    
    // Prepare invoice data
    const invoiceData = {
      amount: amount,
      customerName: customerName,
      customerEmail: customerEmail,
      description: description,
      currencyCode: "NGN",
      contractCode: "465595618981",
      redirectUrl: `${window.location.origin}/dashboard`,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
      metaData: {
        userId: userId
      }
    };
    
    console.log("Sending invoice creation request...");
    const response = await fetch(`${BASE_URL}/api/v1/invoice/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Invoice creation failed:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || `Failed to create invoice: ${response.status}`
      };
    }
    
    if (!responseData.requestSuccessful) {
      console.error("Invoice creation failed with error:", responseData);
      return { 
        success: false, 
        message: responseData.responseMessage || "Failed to create invoice" 
      };
    }
    
    console.log("Invoice creation successful:", responseData);
    return {
      success: true,
      checkoutUrl: responseData.responseBody.checkoutUrl,
      invoiceReference: responseData.responseBody.invoiceReference,
      message: "Invoice created successfully"
    };
  } catch (error) {
    console.error("Error creating payment invoice:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unable to create payment invoice" 
    };
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
