import { supabase } from '@/integrations/supabase/client'
import { EdgeFunctionService } from '@/services/supabase/edgeFunctionService'
import { UserService } from './userService'
import { TransactionService } from './transactionService'
import { toast } from 'sonner'

export interface ReservedAccountData {
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  flwRef?: string;
  orderRef?: string;
  accountReference?: string;
  reservationReference?: string;
  status?: string;
  createdOn?: string;
  createdAt?: string;
  bankCode?: string;
  accounts?: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
}

export class WalletService {
  // Get existing virtual account from user profile
  static async getVirtualAccount(userId: string): Promise<ReservedAccountData | null> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user || !user.preferences) {
        return null;
      }

      const preferences = user.preferences as any;
      return preferences.virtualAccount || null;
    } catch (error) {
      console.error("Error getting virtual account:", error);
      return null;
    }
  }

  // Create virtual account using Edge Function
  static async createVirtualAccount(
    userId: string,
    idType: string,
    idNumber: string
  ): Promise<ReservedAccountData | null> {
    try {
      // Get user data
      const user = await UserService.getUserById(userId);
      if (!user) {
        toast.error("User not found");
        return null;
      }

      // Validate ID information
      if (!idType || !idNumber) {
        toast.error("BVN is required to create a virtual account");
        return null;
      }

      if (idType !== "bvn") {
        toast.error("Only BVN is supported for virtual account creation");
        return null;
      }

      // Create a unique transaction reference with additional randomness
      const txRef = `COLL_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Call Edge Function to create virtual account
      const result = await EdgeFunctionService.createVirtualAccount({
        email: user.email || '',
        tx_ref: txRef,
        bvn: idNumber,
        narration: `Virtual account for ${user.name || 'User'}`
      });

      if (!result || !result.success || !result.data) {
        toast.error(result?.error || "Failed to create virtual account");
        return null;
      }

      const responseData = result.data;

      // Create the reserved account data object
      const reservedAccount: ReservedAccountData = {
        accountNumber: responseData.account_number,
        bankName: responseData.bank_name,
        accountName: user.name || 'User',
        flwRef: responseData.flw_ref,
        orderRef: responseData.order_ref,
        accountReference: responseData.account_reference,
        createdAt: new Date().toISOString()
      };

      // Store virtual account details in user profile
      await UserService.updateUser(userId, {
        preferences: {
          ...user.preferences as any,
          virtualAccount: reservedAccount
        }
      });

      toast.success("Virtual account created successfully");
      return reservedAccount;

    } catch (error) {
      console.error("Error creating virtual account:", error);
      toast.error("Failed to create virtual account. Please try again.");
      return null;
    }
  }

  // Manual transaction check using account number
  static async checkForNewTransactions(userId: string) {
    try {
      const virtualAccount = await this.getVirtualAccount(userId);
      if (!virtualAccount?.accountNumber) {
        console.log('No virtual account found for user');
        return [];
      }

      console.log('Checking transactions for account:', virtualAccount.accountNumber);
      
      // For now, we'll simulate checking for transactions
      // In a real implementation, you'd call Flutterwave API or use webhooks
      
      // Check if user has any recent transactions in the database
      const existingTransactions = await TransactionService.getUserTransactions(userId);
      console.log('Existing transactions:', existingTransactions.length);
      
      return existingTransactions;
    } catch (error) {
      console.error("Error checking for new transactions:", error);
      return [];
    }
  }

  // Get virtual account transactions using Edge Function
  static async getVirtualAccountTransactions(accountReference: string, userId: string) {
    try {
      const result = await EdgeFunctionService.getVirtualAccountTransactions(accountReference);
      
      if (!result || !result.success) {
        return [];
      }

      const transactions = result.data?.content || [];

      // Process each transaction and create transaction records
      for (const transaction of transactions) {
        if (transaction.paymentReference) {
          // Check if transaction already exists
          const existingTransactions = await TransactionService.getUserTransactions(userId);
          const exists = existingTransactions.some(t => 
            t.reference_id === transaction.paymentReference
          );

          if (!exists) {
            // Create new transaction record
            await TransactionService.createTransaction({
              user_id: userId,
              type: 'deposit',
              amount: transaction.amount,
              description: `Deposit via bank transfer (${transaction.bankName || 'Bank'})`,
              reference_id: transaction.paymentReference,
              payment_method: 'bank_transfer',
              status: 'completed',
              metadata: {
                senderName: transaction.senderName || transaction.paymentDescription || "Bank Transfer",
                bankName: transaction.bankName || "",
                narration: transaction.narration || transaction.paymentDescription || "",
                transactionReference: transaction.transactionReference || "",
                paymentReference: transaction.paymentReference || "",
              }
            });

            // Update user's wallet balance
            const user = await UserService.getUserById(userId);
            if (user) {
              const newBalance = (user.wallet_balance || 0) + transaction.amount;
              await UserService.updateWalletBalance(userId, newBalance);
              
              // Trigger a refresh in the UI by updating localStorage
              const currentUserData = localStorage.getItem('currentUser');
              if (currentUserData) {
                const currentUser = JSON.parse(currentUserData);
                if (currentUser.id === userId) {
                  currentUser.wallet_balance = newBalance;
                  localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
              }
            }
          }
        }
      }

      return transactions;

    } catch (error) {
      console.error("Error fetching virtual account transactions:", error);
      toast.error("Failed to fetch transactions. Please try again.");
      return [];
    }
  }

  // Manual function to add a transaction (for testing)
  static async addManualTransaction(userId: string, amount: number, description: string) {
    try {
      console.log('Adding manual transaction:', { userId, amount, description });
      
      // Create transaction record
      const transaction = await TransactionService.createTransaction({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        description: description,
        reference_id: `MANUAL_${Date.now()}`,
        payment_method: 'bank_transfer',
        status: 'completed',
        metadata: {
          manual: true,
          timestamp: new Date().toISOString()
        }
      });

      // Update user's wallet balance
      const user = await UserService.getUserById(userId);
      if (user) {
        const newBalance = (user.wallet_balance || 0) + amount;
        await UserService.updateWalletBalance(userId, newBalance);
        
        // Update localStorage
        const currentUserData = localStorage.getItem('currentUser');
        if (currentUserData) {
          const currentUser = JSON.parse(currentUserData);
          if (currentUser.id === userId) {
            currentUser.wallet_balance = newBalance;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
          }
        }
        
        toast.success(`Added ₦${amount.toLocaleString()} to your wallet`);
        return { transaction, newBalance };
      }
    } catch (error) {
      console.error("Error adding manual transaction:", error);
      toast.error("Failed to add transaction");
      return null;
    }
  }

  // Create payment invoice using Edge Function
  static async createPaymentInvoice(params: {
    amount: number;
    description: string;
    customerEmail: string;
    customerName: string;
    userId: string;
    contributionId?: string;
  }) {
    try {
      const { amount, description, customerEmail, customerName, userId, contributionId } = params;

      if (!amount || amount <= 0 || !customerEmail || !customerName) {
        toast.error("Invalid payment parameters");
        return null;
      }

      const invoiceData = {
        amount,
        customerName,
        customerEmail,
        paymentReference: `INV_${userId}_${Date.now()}`,
        paymentDescription: description || "Payment via card",
        currencyCode: "NGN",
        contractCode: "465595618981",
        redirectUrl: window.location.origin + "/dashboard"
      };

      const result = await EdgeFunctionService.createPaymentInvoice(invoiceData);

      if (!result || !result.success) {
        toast.error("Failed to create payment invoice");
        return null;
      }

      return {
        invoiceReference: result.data.invoiceReference,
        description: result.data.paymentDescription,
        amount: result.data.amount,
        currencyCode: result.data.currencyCode,
        status: result.data.invoiceStatus,
        customerEmail: result.data.customerEmail,
        customerName: result.data.customerName,
        expiryDate: result.data.expiryDate,
        redirectUrl: result.data.redirectUrl,
        checkoutUrl: result.data.checkoutUrl,
        createdOn: result.data.createdOn,
        createdAt: new Date().toISOString(),
        contributionId: contributionId || ""
      };

    } catch (error) {
      console.error("Error creating payment invoice:", error);
      toast.error("Failed to create payment invoice. Please try again.");
      return null;
    }
  }
}