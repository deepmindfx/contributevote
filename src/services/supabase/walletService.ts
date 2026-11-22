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

  static async createVirtualAccount(details: { bvn: string; claimBonus: boolean } | { verificationId: string }): Promise<
    { verificationUrl: string } | { account: ReservedAccountData; bonusAmount: number }
  > {
    const result = await EdgeFunctionService.createVirtualAccount({ ...details, purpose: 'wallet' });
    if (!result?.success) {
      throw new Error(result?.error || 'Couldn’t set up your bank account. Please try again.');
    }
    if (typeof result.verificationUrl === 'string') return { verificationUrl: result.verificationUrl };
    if (!result.account) throw new Error('Couldn’t set up your bank account. Please try again.');
    return { account: result.account, bonusAmount: Number(result.bonusAmount) || 0 };
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
            // Update user's wallet balance
            const user = await UserService.getUserById(userId);
            if (user) {
              const balanceBefore = user.wallet_balance || 0;
              const newBalance = balanceBefore + transaction.amount;
              await UserService.updateWalletBalance(userId, newBalance);

              // Create new transaction record with balance snapshots
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
                  balance_before: balanceBefore,
                  balance_after: newBalance
                }
              });
              
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

  // Create payment invoice using Edge Function
  static async createPaymentInvoice(params: {
    amount: number;
    description: string;
    customerEmail: string;
    customerName: string;
    userId: string;
    contributionId?: string;
    anonymous?: boolean;
  }) {
    try {
      const { amount, description, customerEmail, customerName, userId, contributionId, anonymous } = params;

      if (!amount || amount <= 0 || !customerEmail || !customerName) {
        toast.error("Invalid payment parameters");
        return null;
      }

      const paymentReference = contributionId
        ? `GROUP_${contributionId}_${Date.now()}`
        : `INV_${userId}_${Date.now()}`;

      const invoiceData = {
        amount,
        customerName,
        customerEmail,
        paymentReference,
        paymentDescription: description || "Payment via card",
        currencyCode: "NGN",
        redirectUrl: `${window.location.origin}/payment-callback`,
        groupId: contributionId || undefined,
        anonymous,
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
