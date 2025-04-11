
// Mock implementation of Monnify API for testing purposes

/**
 * Mock function to create a Monnify reserved account
 * @param data Account creation data
 * @returns Mock response with account details
 */
export const createReservedAccount = async (data: any) => {
  try {
    console.log("Creating reserved account with data:", data);
    
    // In a real implementation, this would make an API call to Monnify
    // POST {base_url}/api/v2/bank-transfer/reserved-accounts
    
    // Mock successful response
    return {
      accountReference: data.accountReference,
      accountName: data.accountName,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      currencyCode: "NGN",
      status: "ACTIVE",
      createdOn: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reservationReference: "MOCK" + Math.random().toString(36).substring(2, 15).toUpperCase(),
      accounts: [
        {
          bankCode: "50515",
          bankName: "Moniepoint Microfinance Bank",
          accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
          accountName: data.accountName
        }
      ]
    };
  } catch (error) {
    console.error("Error creating reserved account:", error);
    return null;
  }
};

/**
 * Mock function to get Monnify reserved account details
 * @param accountReference Account reference
 * @returns Mock response with account details
 */
export const getReservedAccountDetails = async (accountReference: string) => {
  try {
    console.log("Getting reserved account details for:", accountReference);
    
    // In a real implementation, this would make an API call to Monnify
    // GET {base_url}/api/v2/bank-transfer/reserved-accounts/{accountReference}
    
    // Mock successful response
    return {
      accountReference: accountReference,
      accountName: "Bluecircle-" + accountReference.split('_')[1].substring(0, 3),
      reservationReference: "MOCK" + Math.random().toString(36).substring(2, 15).toUpperCase(),
      status: "ACTIVE",
      createdOn: new Date().toISOString().replace('T', ' ').substring(0, 19),
      accounts: [
        {
          bankCode: "50515",
          bankName: "Moniepoint Microfinance Bank",
          accountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString(),
          accountName: "Bluecircle-" + accountReference.split('_')[1].substring(0, 3)
        }
      ]
    };
  } catch (error) {
    console.error("Error getting reserved account details:", error);
    return null;
  }
};

/**
 * Mock function to get Monnify reserved account transactions
 * @param accountReference Account reference
 * @returns Mock response with transactions
 */
export const getReservedAccountTransactions = async (accountReference: string) => {
  try {
    console.log("Getting reserved account transactions for:", accountReference);
    
    // In a real implementation, this would make an API call to Monnify
    // GET {base_url}/api/v1/bank-transfer/reserved-accounts/transactions?accountReference={accountReference}
    
    // Generate 1-3 random mock transactions for testing
    const transactionCount = Math.floor(1 + Math.random() * 3);
    const transactions = [];
    
    for (let i = 0; i < transactionCount; i++) {
      const amount = Math.floor(1000 + Math.random() * 9000);
      const transactionDate = new Date();
      transactionDate.setDate(transactionDate.getDate() - i);
      
      transactions.push({
        amount: amount,
        paymentReference: "MOCKPAY" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        transactionReference: "MOCKTRANS" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        paymentMethod: "ACCOUNT_TRANSFER",
        paidOn: transactionDate.toISOString(),
        paymentStatus: "PAID",
        destinationAccountName: "Bluecircle-" + accountReference.split('_')[1].substring(0, 3),
        destinationBankName: "Moniepoint Microfinance Bank",
        destinationAccountNumber: "60" + Math.floor(10000000 + Math.random() * 90000000).toString()
      });
    }
    
    // Mock successful response
    return {
      content: transactions,
      totalElements: transactions.length,
      totalPages: 1,
      size: 10,
      page: 0,
      first: true,
      last: true
    };
  } catch (error) {
    console.error("Error getting reserved account transactions:", error);
    return null;
  }
};

/**
 * Mock function to create a Monnify invoice
 * @param data Invoice creation data
 * @returns Mock response with invoice details
 */
export const createInvoice = async (data: any) => {
  try {
    console.log("Creating invoice with data:", data);
    
    // In a real implementation, this would make an API call to Monnify
    // POST {base_url}/api/v1/invoice/create
    
    // Mock successful response
    return {
      invoiceReference: data.invoiceReference,
      description: data.description,
      amount: data.amount,
      status: "PENDING",
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      expiryDate: data.expiryDate,
      redirectUrl: data.redirectUrl,
      checkoutUrl: "#",
      createdOn: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error creating invoice:", error);
    return null;
  }
};

/**
 * Mock function to charge a Monnify card token
 * @param data Card token charging data
 * @returns Mock response with payment details
 */
export const chargeCardToken = async (data: any) => {
  try {
    console.log("Charging card token with data:", data);
    
    // In a real implementation, this would make an API call to Monnify
    // POST {base_url}/api/v1/payments/charge-card-token
    
    // Mock successful response
    return {
      transactionReference: "MOCKTRANS" + Math.random().toString(36).substring(2, 10).toUpperCase(),
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
    };
  } catch (error) {
    console.error("Error charging card token:", error);
    return null;
  }
};
