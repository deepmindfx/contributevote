
// The Monnify API service for virtual accounts and payments

// Base URL and API config
const MONNIFY_BASE_URL = "https://sandbox.monnify.com"; // Use sandbox for testing
const MONNIFY_API_KEY = "MK_TEST_SAM7AJ9NP7"; // This would be replaced with your actual API key
const MONNIFY_SECRET_KEY = "YDNXNDENP8AXQ4ZFZ4D9QJMVWK3S8MR4"; // This would be replaced with your actual secret key
const MONNIFY_CONTRACT_CODE = "8389328412"; // This would be replaced with your actual contract code

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
      // In a real implementation, this would make an actual API call
      // For now, we'll simulate the authentication process
      console.log("Getting Monnify auth token");
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Return a dummy token for development purposes
      return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
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

      // In a real implementation, this would make an actual API call
      console.log("Creating virtual account with Monnify", requestData);
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock response for development/demo purposes
      const mockResponse: MonnifyResponse<ReserveAccountResponse> = {
        requestSuccessful: true,
        responseMessage: "success",
        responseCode: "0",
        responseBody: {
          contractCode: MONNIFY_CONTRACT_CODE,
          accountReference: requestData.accountReference,
          accountName: requestData.accountName,
          currencyCode: "NGN",
          customerEmail: user.email,
          customerName: requestData.customerName,
          accounts: [
            {
              bankCode: "50515",
              bankName: "Moniepoint Microfinance Bank",
              accountNumber: this.generateMockAccountNumber(),
              accountName: requestData.accountName
            }
          ],
          collectionChannel: "RESERVED_ACCOUNT",
          reservationReference: this.generateMockReference(),
          reservedAccountType: "GENERAL",
          status: "ACTIVE",
          createdOn: new Date().toISOString(),
          incomeSplitConfig: [],
          restrictPaymentSource: false
        }
      };
      
      return mockResponse.responseBody;
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
      const token = await this.getAuthToken();
      
      console.log("Getting transactions for account reference:", accountReference);
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate mock transactions for development purposes
      const mockTransactions: Transaction[] = [];
      
      // Create 3 random transactions
      for (let i = 0; i < 3; i++) {
        mockTransactions.push({
          id: this.generateMockReference(),
          transactionReference: this.generateMockReference(),
          paymentReference: this.generateMockReference(),
          amount: Math.floor(Math.random() * 50000) + 1000, // Random amount between 1,000 and 50,000
          currency: "NGN",
          paymentStatus: "PAID",
          paymentMethod: "ACCOUNT_TRANSFER",
          paidOn: new Date(Date.now() - (i * 86400000)).toISOString(), // Dates spread over the last few days
          createdOn: new Date(Date.now() - (i * 86400000)).toISOString(),
          customerName: "Mock Customer",
          customerEmail: "mock@customer.com",
          accountName: "Mock Sender",
          accountNumber: this.generateMockAccountNumber(),
          bankName: "Mock Bank"
        });
      }
      
      return mockTransactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw new Error("Failed to fetch transactions");
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
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful transfer initiation
      return {
        reference: params.reference,
        status: "PROCESSING"
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
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock bank list
      return [
        { bankCode: "057", bankName: "Zenith Bank" },
        { bankCode: "058", bankName: "GTBank" },
        { bankCode: "232", bankName: "Sterling Bank" },
        { bankCode: "033", bankName: "UBA" },
        { bankCode: "044", bankName: "Access Bank" },
        { bankCode: "063", bankName: "Diamond Bank" },
        { bankCode: "050", bankName: "Ecobank" },
        { bankCode: "221", bankName: "Stanbic IBTC" },
        { bankCode: "068", bankName: "Standard Chartered" },
        { bankCode: "215", bankName: "Unity Bank" },
        { bankCode: "035", bankName: "Wema Bank" },
        { bankCode: "301", bankName: "JAIZ Bank" },
        { bankCode: "082", bankName: "Keystone Bank" },
        { bankCode: "076", bankName: "Polaris Bank" },
        { bankCode: "50515", bankName: "Moniepoint Microfinance Bank" }
      ];
    } catch (error) {
      console.error("Error getting banks:", error);
      throw new Error("Failed to get supported banks");
    }
  }

  // Utility methods for generating mock data
  private generateMockAccountNumber(): string {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }
  
  private generateMockReference(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Export a singleton instance
export const monnifyAPI = new MonnifyAPI();
