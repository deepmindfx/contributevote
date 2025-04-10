
// The Monnify API service for virtual accounts and payments

// Base URL and API config
const MONNIFY_BASE_URL = "https://api.monnify.com"; // Production URL
const MONNIFY_API_KEY = "MK_PROD_XR897H4H43"; // Production API key
const MONNIFY_SECRET_KEY = "GPFCA9GTP81DYJGF9VMAPRK220SS6CK9"; // Production secret key
const MONNIFY_CONTRACT_CODE = "8389328412"; // Would be replaced with your actual contract code

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

// Monnify API Helper class
class MonnifyAPI {
  private async getAuthToken(): Promise<string> {
    try {
      // Create auth credentials
      const credentials = `${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`;
      const encodedCredentials = btoa(credentials);
      
      // Make API call to get token
      const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        throw new Error(data.responseMessage || 'Failed to authenticate with Monnify');
      }
      
      // Return the actual token
      return data.responseBody.accessToken;
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
      
      // Format the user data for the Monnify API
      const requestData: ReserveAccountRequest = {
        accountReference: `user_${user.id}`,
        accountName: `${user.firstName} ${user.lastName || ""}`.trim(),
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName || ""}`.trim(),
        currencyCode: "NGN",
        contractCode: MONNIFY_CONTRACT_CODE,
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
      const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json() as MonnifyResponse<ReserveAccountResponse>;
      
      if (!data.requestSuccessful) {
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
      
      console.log("Getting transactions for account reference:", accountReference);
      
      // Make API call to get transactions
      const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/transactions/search?accountReference=${accountReference}&page=0&size=20`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      // Handle the case where there are no transactions - this is not an error
      if (!data.requestSuccessful) {
        if (data.responseMessage.includes("no transaction matching supplied reference")) {
          console.log("No transactions found for this account reference yet");
          return [];
        }
        throw new Error(data.responseMessage || 'Failed to fetch transactions');
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
      const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single`, {
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
  async getBanks(): Promise<{ bankCode: string; bankName: string }[]> {
    try {
      const token = await this.getAuthToken();
      
      console.log("Getting supported banks");
      
      // Make API call to get banks
      const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/banks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!data.requestSuccessful) {
        throw new Error(data.responseMessage || 'Failed to get supported banks');
      }
      
      // Format and return banks
      return data.responseBody.map((bank: any) => ({
        bankCode: bank.code,
        bankName: bank.name
      }));
    } catch (error) {
      console.error("Error getting banks:", error);
      throw new Error("Failed to get supported banks");
    }
  }
}

// Export a singleton instance
export const monnifyAPI = new MonnifyAPI();
