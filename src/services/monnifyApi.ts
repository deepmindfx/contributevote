
// Monnify API service for handling virtual account operations

// Base URL for Monnify API 
const BASE_URL = 'https://sandbox.monnify.com';

/**
 * Get authentication token for API access
 * @returns Auth token for subsequent API calls
 */
export const getAuthToken = async () => {
  try {
    // In a real implementation, this would make an API call to get authentication token
    // For demo purposes, we return a placeholder token
    return "monnify_auth_token";
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
    
    // In a real environment, this would call the Monnify API
    // POST {base_url}/api/v2/bank-transfer/reserved-accounts
    
    const response = {
      requestSuccessful: true,
      responseMessage: "Reserved account created successfully",
      responseCode: "0",
      responseBody: {
        contractCode: "123456789",
        accountReference: data.accountReference,
        accountName: data.accountName,
        currencyCode: "NGN",
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        bankName: "Moniepoint Microfinance Bank",
        bankCode: "50515",
        reservationReference: "RA_" + Math.random().toString(36).substring(2, 15).toUpperCase(),
        status: "ACTIVE",
        createdOn: new Date().toISOString(),
        accounts: [
          {
            bankCode: "50515",
            bankName: "Moniepoint Microfinance Bank",
            accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
            accountName: data.accountName
          }
        ]
      }
    };
    
    // Return the response body
    return response.responseBody;
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
    
    // In a real environment, this would call the Monnify API
    // GET {base_url}/api/v2/bank-transfer/reserved-accounts/{accountReference}
    
    const response = {
      requestSuccessful: true,
      responseMessage: "Reserved account details retrieved successfully",
      responseCode: "0",
      responseBody: {
        contractCode: "123456789",
        accountReference: accountReference,
        accountName: "Bluecircle-" + accountReference.substring(5, 11),
        currencyCode: "NGN",
        customerEmail: "user@example.com",
        customerName: "Bluecircle User",
        accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        bankName: "Moniepoint Microfinance Bank",
        bankCode: "50515",
        reservationReference: "RA_" + Math.random().toString(36).substring(2, 15).toUpperCase(),
        status: "ACTIVE",
        createdOn: new Date().toISOString(),
        accounts: [
          {
            bankCode: "50515",
            bankName: "Moniepoint Microfinance Bank",
            accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
            accountName: "Bluecircle-" + accountReference.substring(5, 11)
          }
        ]
      }
    };
    
    // Return the response body
    return response.responseBody;
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
    
    // In a real environment, this would call the Monnify API
    // GET {base_url}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference={accountReference}
    
    // Generate a few transactions for demo purposes
    const transactions = [];
    
    // Add some realistic transactions
    transactions.push({
      amount: 5000,
      paymentReference: "PAY" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      transactionReference: "TRX" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      paymentMethod: "ACCOUNT_TRANSFER",
      paidOn: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      paymentStatus: "PAID",
      destinationAccountName: "Bluecircle-" + accountReference.substring(5, 11),
      destinationBankName: "Moniepoint Microfinance Bank",
      destinationAccountNumber: "6012345678"
    });
    
    transactions.push({
      amount: 10000,
      paymentReference: "PAY" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      transactionReference: "TRX" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      paymentMethod: "ACCOUNT_TRANSFER",
      paidOn: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      paymentStatus: "PAID",
      destinationAccountName: "Bluecircle-" + accountReference.substring(5, 11),
      destinationBankName: "Moniepoint Microfinance Bank",
      destinationAccountNumber: "6012345678"
    });
    
    const response = {
      requestSuccessful: true,
      responseMessage: "Transactions retrieved successfully",
      responseCode: "0",
      responseBody: {
        content: transactions,
        totalElements: transactions.length,
        totalPages: 1,
        size: 10,
        page: 0,
        first: true,
        last: true
      }
    };
    
    // Return the response body
    return response.responseBody;
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
    
    // In a real environment, this would call the Monnify API
    // POST {base_url}/api/v1/invoice/create
    
    const response = {
      requestSuccessful: true,
      responseMessage: "Invoice created successfully",
      responseCode: "0",
      responseBody: {
        invoiceReference: data.invoiceReference || "INV" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        description: data.description,
        amount: data.amount,
        currencyCode: data.currencyCode || "NGN",
        status: "PENDING",
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        expiryDate: data.expiryDate,
        redirectUrl: data.redirectUrl,
        checkoutUrl: "#",
        createdOn: new Date().toISOString()
      }
    };
    
    // Return the response body
    return response.responseBody;
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
    
    // In a real environment, this would call the Monnify API
    // POST {base_url}/api/v1/payments/charge-card-token
    
    const response = {
      requestSuccessful: true,
      responseMessage: "Card charged successfully",
      responseCode: "0",
      responseBody: {
        transactionReference: "TRX" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        paymentReference: data.paymentReference,
        amount: data.amount,
        totalPayment: data.amount,
        settlementAmount: data.amount,
        paidOn: new Date().toISOString(),
        paymentStatus: "PAID",
        paymentDescription: data.paymentDescription,
        paymentMethod: "CARD",
        cardType: "VISA",
        metaData: data.metaData
      }
    };
    
    // Return the response body
    return response.responseBody;
  } catch (error) {
    console.error("Error charging card token:", error);
    throw error;
  }
};
