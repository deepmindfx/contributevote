
// Since we can't modify this file, we'll create a stub implementation 
// that will simulate the API call for now

export const createReservedAccount = async (data: {
  contractCode: string;
  accountName: string;
  currencyCode: string;
  accountReference: string;
  customerEmail: string;
  customerName: string;
  customerBvn: string;
  getAllAvailableBanks: boolean;
}) => {
  console.log("Creating reserved account with data:", data);
  
  // In a real implementation, this would call the Monnify API
  // For now, we'll simulate a response
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate a random account number
  const accountNumber = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  
  // Return a mock response
  return {
    responseCode: "0",
    responseMessage: "success",
    responseBody: {
      contractCode: data.contractCode,
      accountReference: data.accountReference,
      accountName: data.accountName,
      currencyCode: data.currencyCode,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      accountNumber: accountNumber,
      bankName: "Moniepoint MFB",
      bankCode: "100035",
      collectionChannel: "RESERVED_ACCOUNT",
      status: "ACTIVE",
      createdOn: new Date().toISOString(),
      reservationReference: `RES_${Math.random().toString(36).substring(2, 15)}`
    },
    // Extracted fields for easy access
    accountNumber: accountNumber,
    bankName: "Moniepoint MFB",
    bankCode: "100035"
  };
};

// Function to check payment status
export const checkPaymentStatus = async (reference: string) => {
  console.log("Checking payment status for reference:", reference);
  
  // In a real implementation, this would call the Monnify API
  // For now, we'll simulate a response
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return a mock response with 85% chance of success
  const success = Math.random() > 0.15;
  
  return {
    responseCode: success ? "0" : "99",
    responseMessage: success ? "success" : "pending",
    responseBody: {
      paymentReference: reference,
      amountPaid: success ? Math.floor(1000 + Math.random() * 9000) : 0,
      totalPayable: Math.floor(1000 + Math.random() * 9000),
      settlementAmount: success ? Math.floor(1000 + Math.random() * 9000) : 0,
      paidOn: success ? new Date().toISOString() : null,
      paymentStatus: success ? "PAID" : "PENDING",
      paymentDescription: "Group contribution",
      transactionReference: `TRF_${Math.random().toString(36).substring(2, 15)}`,
      paymentMethod: "ACCOUNT_TRANSFER"
    }
  };
};
