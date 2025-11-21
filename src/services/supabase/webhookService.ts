import { UserService } from './userService'
import { TransactionService } from './transactionService'
import { WalletService } from './walletService'

export class WebhookService {
  // Process incoming webhook from Flutterwave
  static async processWebhook(webhookData: any) {
    try {
      console.log('Processing webhook:', webhookData)
      
      if (webhookData.event === 'charge.completed' && webhookData.data) {
        await this.handleSuccessfulPayment(webhookData.data)
      }
      
      if (webhookData.event === 'transfer.completed' && webhookData.data) {
        await this.handleSuccessfulTransfer(webhookData.data)
      }
      
    } catch (error) {
      console.error('Error processing webhook:', error)
      throw error
    }
  }

  // Handle successful payment (money coming in)
  static async handleSuccessfulPayment(paymentData: any) {
    try {
      // Find user by email or transaction reference
      const userEmail = paymentData.customer?.email
      if (!userEmail) return

      const user = await UserService.getUserByEmail(userEmail)
      if (!user) return

      // Check if transaction already exists
      const existingTransactions = await TransactionService.getUserTransactions(user.id)
      const exists = existingTransactions.some(t => 
        t.reference_id === paymentData.tx_ref || 
        t.reference_id === paymentData.flw_ref
      )

      if (!exists) {
        // Update user wallet balance
        const newBalance = (user.wallet_balance || 0) + paymentData.amount
        await UserService.updateWalletBalance(user.id, newBalance)

        // Create transaction record
        await TransactionService.createTransaction({
          user_id: user.id,
          type: 'deposit',
          amount: paymentData.amount,
          description: `Payment received via ${paymentData.payment_type || 'card'}`,
          reference_id: paymentData.tx_ref || paymentData.flw_ref,
          payment_method: paymentData.payment_type || 'card',
          status: 'completed',
          metadata: {
            flutterwaveRef: paymentData.flw_ref,
            txRef: paymentData.tx_ref,
            paymentType: paymentData.payment_type,
            currency: paymentData.currency,
            customerEmail: paymentData.customer?.email,
            customerName: paymentData.customer?.name,
            balance_before: user.wallet_balance || 0,
            balance_after: newBalance
          }
        })

        console.log(`Updated wallet balance for ${user.email}: +${paymentData.amount}`)
      }
    } catch (error) {
      console.error('Error handling successful payment:', error)
      throw error
    }
  }

  // Handle successful transfer (money going out)
  static async handleSuccessfulTransfer(transferData: any) {
    try {
      // This would handle outgoing transfers
      // Implementation depends on your transfer flow
      console.log('Transfer completed:', transferData)
    } catch (error) {
      console.error('Error handling successful transfer:', error)
      throw error
    }
  }

  // Handle virtual account credit (bank transfer received)
  static async handleVirtualAccountCredit(creditData: any) {
    try {
      // Find user by virtual account details
      const accountNumber = creditData.account_number
      if (!accountNumber) return

      // Find user with this virtual account
      const allUsers = await UserService.getUsers()
      const user = allUsers.find(u => {
        const preferences = u.preferences as any
        return preferences?.virtualAccount?.accountNumber === accountNumber
      })

      if (!user) return

      // Check if transaction already exists
      const existingTransactions = await TransactionService.getUserTransactions(user.id)
      const exists = existingTransactions.some(t => 
        t.reference_id === creditData.payment_reference ||
        t.reference_id === creditData.transaction_reference
      )

      if (!exists) {
        // Create transaction record
        await TransactionService.createTransaction({
          user_id: user.id,
          type: 'deposit',
          amount: creditData.amount,
          description: `Bank transfer from ${creditData.sender_name || 'Bank'}`,
          reference_id: creditData.payment_reference || creditData.transaction_reference,
          payment_method: 'bank_transfer',
          status: 'completed',
          metadata: {
            senderName: creditData.sender_name,
            senderBank: creditData.sender_bank,
            narration: creditData.narration,
            paymentReference: creditData.payment_reference,
            transactionReference: creditData.transaction_reference
          }
        })

        // Update user wallet balance
        const newBalance = (user.wallet_balance || 0) + creditData.amount
        await UserService.updateWalletBalance(user.id, newBalance)

        console.log(`Virtual account credited for ${user.email}: +${creditData.amount}`)
      }
    } catch (error) {
      console.error('Error handling virtual account credit:', error)
      throw error
    }
  }
}