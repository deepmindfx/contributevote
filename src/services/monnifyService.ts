// The Monnify API service for virtual accounts and payments

// Base URL and API config
const MONNIFY_BASE_URL = "https://api.monnify.com"; // Changed to production URL
const MONNIFY_API_KEY = "MK_PROD_XR897H4H43"; // Updated to production API key
const MONNIFY_SECRET_KEY = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9"; // Updated to production secret key
const MONNIFY_CONTRACT_CODE = "465595618981"; // Contract code

// Retrieve stored credentials if available
const getStoredCredentials = () => {
  try {
    const storedCredentials = localStorage.getItem('monnify_credentials');
    if (storedCredentials) {
      return JSON.parse(storedCredentials);
    }
  } catch (error) {
    console.error("Error retrieving stored credentials:", error);
  }
  return null;
};

// Get the credentials, preferring stored ones if available
const getCredentials = () => {
  const storedCredentials = getStoredCredentials();
  
  return {
    apiKey: storedCredentials?.apiKey || MONNIFY_API_KEY,
    secretKey: storedCredentials?.secretKey || MONNIFY_SECRET_KEY,
    contractCode: storedCredentials?.contractCode || MONNIFY_CONTRACT_CODE,
    baseUrl: storedCredentials?.baseUrl || MONNIFY_BASE_URL
  };
};

// Interface for Monnify API responses
interface MonnifyResponse<T> {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: T;
}

// Interface for virtual account creation request
interface ReserveAccountRequest {
  accountReference: string;
  accountName: string;
  customerEmail: string;
  customerName: string;
  currencyCode: "NGN";
  contractCode: string;
  bvn?: string;
  nin?: string;
  getAllAvailableBanks: boolean;
  restrictPaymentSource?: boolean;
  allowedPaymentSources?: {
    bvns?: string[];
    bankAccounts?: {
      accountNumber: string;
      bankCode: string;
    }[];
    accountNames?: string[];
  };
}

// Interface for account details returned from Monnify
interface ReserveAccountResponse {
  contractCode: string;
  accountReference: string;
  accountName: string;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  accounts: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }[];
  collectionChannel: string;
  reservationReference: string;
  reservedAccountType: string;
  status: string;
  createdOn: string;
  incomeSplitConfig: any[];
  bvn?: string;
  restrictPaymentSource: boolean;
}

// Transaction interfaces
interface Transaction {
  id: string;
  transactionReference: string;
  paymentReference: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  paidOn: string;
  createdOn: string;
  customerName: string;
  customerEmail: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
}

// Interface for bank details
interface Bank {
  bankCode: string;
  bankName: string;
}

// Interface for wallet balance
interface WalletBalanceResponse {
  availableBalance: number;
  ledgerBalance: number;
}

// Monnify API Helper class
class MonnifyAPI {
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  // Check if token is expired
  private isTokenExpired(): boolean {
    return !this.authToken || Date.now() > this.tokenExpiry;
  }

  private async getAuthToken(): Promise<string> {
    try {
      // If we have a valid token, return it
      if (!this.isTokenExpired()) {
        return this.authToken as string;
      }

      const credentials = getCredentials();
      
      // Create auth credentials
      const auth = `${credentials.apiKey}:${credentials.secretKey}`;
      const encodedCredentials = btoa(auth);
      
      console.log("Getting auth token from Monnify");
      
      // Make API call to get token
      const response = await fetch(`${credentials.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        console.error("Auth token error:", data.responseMessage || "Authentication failed");
        throw new Error(data.responseMessage || 'Failed to authenticate with Monnify');
      }
      
      // Set token and expiry (1 hour from now)
      this.authToken = data.responseBody.accessToken;
      this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes to be safe
      
      // Return the actual token
      return this.authToken;
    } catch (error) {
      console.error("Error getting auth token:", error);
      throw new Error("Failed to authenticate with Monnify");
    }
  }

  /**
   * Create a virtual account for a user
   */
  async createVirtualAccount(user: { 
    id: string; 
    firstName: string; 
    lastName?: string; 
    email: string; 
    bvn?: string;
    nin?: string;
  }): Promise<ReserveAccountResponse> {
    try {
      // Get authentication token
      const token = await this.getAuthToken();
      const credentials = getCredentials();
      
      // Format the user data for the Monnify API
      const requestData: ReserveAccountRequest = {
        accountReference: `user_${user.id}`,
        accountName: `${user.firstName} ${user.lastName || ""}`.trim(),
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName || ""}`.trim(),
        currencyCode: "NGN",
        contractCode: credentials.contractCode,
        getAllAvailableBanks: true
      };
      
      // Add BVN if available
      if (user.bvn) {
        requestData.bvn = user.bvn;
      }
      
      // Add NIN if available
      if (user.nin) {
        requestData.nin = user.nin;
      }

      console.log("Creating virtual account with Monnify", requestData);
      
      // Make the actual API call
      const response = await fetch(`${credentials.baseUrl}/api/v2/bank-transfer/reserved-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        console.error("Virtual account creation error:", data.responseMessage);
        throw new Error(data.responseMessage || 'Failed to create virtual account');
      }
      
      return data.responseBody;
    } catch (error) {
      console.error("Error creating virtual account:", error);
      throw new Error("Failed to create virtual account");
    }
  }

  /**
   * Get transactions for a virtual account
   */
  async getTransactions(accountReference: string): Promise<Transaction[]> {
    try {
      if (!accountReference) {
        console.warn("No account reference provided for transaction fetch");
        return [];
      }
      
      const token = await this.getAuthToken();
      const credentials = getCredentials();
      
      console.log("Getting transactions for account reference:", accountReference);
      
      // Make API call to get transactions
      const response = await fetch(`${credentials.baseUrl}/api/v2/transactions/search?accountReference=${accountReference}&page=0&size=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      // Handle the case where there are no transactions - this is not an error
      if (!data.requestSuccessful) {
        if (data.responseMessage && data.responseMessage.includes("no transaction matching supplied reference")) {
          console.log("No transactions found for this account reference yet");
          return [];
        }
        throw new Error(data.responseMessage || 'Failed to fetch transactions');
      }
      
      console.log("Transactions response:", data);
      
      // Calculate wallet balance from transactions
      let totalBalance = 0;
      if (data.responseBody && data.responseBody.content) {
        const paidTransactions = data.responseBody.content.filter((tx: any) => tx.paymentStatus === "PAID");
        totalBalance = paidTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
        console.log("Calculated balance from transactions:", totalBalance);
        
        // Update localStorage with the new balance
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            user.walletBalance = totalBalance;
            localStorage.setItem('user', JSON.stringify(user));
            console.log("Updated wallet balance in localStorage:", totalBalance);
          }
        } catch (error) {
          console.error("Error updating wallet balance in localStorage:", error);
        }
      }
      
      // Format and return transactions
      return data.responseBody.content.map((tx: any) => ({
        id: tx.transactionReference,
        transactionReference: tx.transactionReference,
        paymentReference: tx.paymentReference,
        amount: tx.amount,
        currency: tx.currency,
        paymentStatus: tx.paymentStatus,
        paymentMethod: tx.paymentMethod,
        paidOn: tx.paidOn,
        createdOn: tx.createdOn,
        customerName: tx.customerName,
        customerEmail: tx.customerEmail,
        accountName: tx.destinationAccountInformation?.accountName,
        accountNumber: tx.destinationAccountInformation?.accountNumber,
        bankName: tx.destinationAccountInformation?.bankName
      }));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      // Return empty array instead of throwing to avoid breaking the UI
      return [];
    }
  }

  /**
   * Get wallet balance using the proper API endpoint
   */
  async getWalletBalance(accountReference: string): Promise<number> {
    try {
      const token = await this.getAuthToken();
      const credentials = getCredentials();
      
      console.log("Getting wallet balance for account reference:", accountReference);
      
      // First try to use the proper wallet balance endpoint
      try {
        const response = await fetch(`${credentials.baseUrl}/api/v1/disbursements/wallet/balance?accountNumber=${accountReference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (data.requestSuccessful) {
          const balance = data.responseBody.availableBalance / 100; // Convert from kobo to naira
          console.log("Retrieved wallet balance from API:", balance);
          
          // Save to localStorage for faster access next time
          this.updateStoredBalance(accountReference, balance);
          
          return balance;
        }
      } catch (error) {
        console.warn("Error using wallet balance endpoint, falling back to transactions:", error);
        // Continue to fallback method
      }
      
      // Fallback: Get transactions and calculate balance
      const transactions = await this.getTransactions(accountReference);
      
      // Calculate balance from transactions
      const balance = transactions
        .filter(tx => tx.paymentStatus === "PAID")
        .reduce((total, tx) => total + Number(tx.amount), 0);
      
      console.log("Calculated wallet balance from transactions:", balance);
      
      // Save calculated balance to localStorage
      this.updateStoredBalance(accountReference, balance);
      
      return balance;
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      
      // If all else fails, try to get balance from localStorage
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          return user.walletBalance || 0;
        }
      } catch (e) {
        console.error("Error getting balance from localStorage:", e);
      }
      
      return 0;
    }
  }
  
  /**
   * Helper method to update the stored balance in localStorage
   */
  private updateStoredBalance(accountReference: string, balance: number) {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        // Only update if user ID matches the account reference
        if (accountReference.includes(user.id)) {
          user.walletBalance = balance;
          localStorage.setItem('user', JSON.stringify(user));
          console.log("Updated wallet balance in localStorage:", balance);
        }
      }
    } catch (error) {
      console.error("Error updating balance in localStorage:", error);
    }
  }

  /**
   * Initialize a payment to another account
   */
  async initiateTransfer(params: {
    amount: number;
    recipientAccountNumber: string;
    recipientBankCode: string;
    recipientName: string;
    reference: string;
    narration: string;
  }): Promise<{ reference: string; status: string }> {
    try {
      const token = await this.getAuthToken();
      const credentials = getCredentials();
      
      console.log("Initiating transfer:", params);
      
      const requestData = {
        amount: params.amount,
        reference: params.reference,
        narration: params.narration,
        destinationBankCode: params.recipientBankCode,
        destinationAccountNumber: params.recipientAccountNumber,
        currency: "NGN",
        sourceAccountNumber: "", // Optional, your reserve account number
        destinationAccountName: params.recipientName
      };
      
      // Make API call to initiate transfer
      const response = await fetch(`${credentials.baseUrl}/api/v2/disbursements/single`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        throw new Error(data.responseMessage || 'Failed to initiate transfer');
      }
      
      return {
        reference: params.reference,
        status: data.responseBody.status || "PROCESSING"
      };
    } catch (error) {
      console.error("Error initiating transfer:", error);
      throw new Error("Failed to initiate transfer");
    }
  }

  /**
   * Get banks supported by Monnify
   */
  async getBanks(): Promise<Bank[]> {
    try {
      const token = await this.getAuthToken();
      const credentials = getCredentials();
      
      console.log("Getting supported banks");
      
      // Make API call to get banks
      const response = await fetch(`${credentials.baseUrl}/api/v1/banks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        console.error("Get banks error:", data.responseMessage || "Could not fetch banks");
        throw new Error(data.responseMessage || 'Failed to get supported banks');
      }
      
      // Format and return banks
      return data.responseBody.map((bank: any) => ({
        bankCode: bank.code,
        bankName: bank.name
      }));
    } catch (error) {
      console.error("Error getting banks:", error);
      throw new Error("Failed to get supported banks. Please try again later.");
    }
  }

  /**
   * Update Monnify API credentials
   */
  updateCredentials(credentials: {
    apiKey: string;
    secretKey: string;
    contractCode: string;
    baseUrl?: string;
  }): boolean {
    try {
      // Validate required fields
      if (!credentials.apiKey || !credentials.secretKey || !credentials.contractCode) {
        return false;
      }

      // Reset token when credentials change
      this.authToken = null;
      this.tokenExpiry = 0;

      // Store credentials in localStorage
      localStorage.setItem('monnify_credentials', JSON.stringify({
        apiKey: credentials.apiKey,
        secretKey: credentials.secretKey,
        contractCode: credentials.contractCode,
        baseUrl: credentials.baseUrl || MONNIFY_BASE_URL
      }));
      
      return true;
    } catch (error) {
      console.error("Error updating credentials:", error);
      return false;
    }
  }

  /**
   * Get current Monnify API credentials
   */
  getApiCredentials() {
    return getCredentials();
  }

  /**
   * Test API credentials with Monnify
   */
  async testCredentials(credentials: {
    apiKey: string;
    secretKey: string;
    contractCode: string;
    baseUrl: string;
  }): Promise<boolean> {
    try {
      // Create auth credentials
      const auth = `${credentials.apiKey}:${credentials.secretKey}`;
      const encodedCredentials = btoa(auth);
      
      // Make API call to get token
      const response = await fetch(`${credentials.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      return data.requestSuccessful === true;
    } catch (error) {
      console.error("Error testing credentials:", error);
      return false;
    }
  }
}

// Export a singleton instance
export const monnifyAPI = new MonnifyAPI();
