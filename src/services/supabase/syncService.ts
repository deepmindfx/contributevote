import { supabase } from '@/integrations/supabase/client'
import { UserService } from './userService'
import { ContributionService } from './contributionService'
import { TransactionService } from './transactionService'
import { WalletService } from './walletService'

export class SyncService {
  // Sync all user data and ensure consistency
  static async syncUserData(userId: string) {
    try {
      console.log('Syncing user data for:', userId)
      
      // Get fresh user data
      const user = await UserService.getUserById(userId)
      if (!user) return null

      // IMPORTANT: We should NOT recalculate balance from all transactions
      // because the database functions already handle balance updates atomically.
      // The wallet balance in the profiles table is the source of truth.
      
      // Only check for new virtual account transactions (bank deposits)
      const virtualAccount = await WalletService.getVirtualAccount(userId)
      if (virtualAccount?.accountReference) {
        await WalletService.getVirtualAccountTransactions(virtualAccount.accountReference, userId)
      }

      // Return updated user data
      return await UserService.getUserById(userId)
    } catch (error) {
      console.error('Error syncing user data:', error)
      throw error
    }
  }

  // Sync contribution group data
  static async syncContributionData(contributionId: string) {
    try {
      console.log('Syncing contribution data for:', contributionId)
      
      // Get contribution group
      const contribution = await ContributionService.getContributionGroupById(contributionId)
      if (!contribution) return null

      // Get all contributors
      const contributors = await ContributionService.getGroupContributors(contributionId)
      
      // Calculate total contributed amount
      let totalContributed = 0
      contributors.forEach(contributor => {
        totalContributed += Number((contributor as any).total_contributed || 0)
      })

      // Calculate total executed withdrawals (voting + instant)
      let totalWithdrawn = 0
      const { data: withdrawals, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('amount, status')
        .eq('contribution_id', contributionId)
        .in('status', ['approved', 'executed'])

      if (withdrawalError) {
        console.error('Error fetching withdrawals for sync:', withdrawalError)
      } else {
        withdrawals?.forEach(withdrawal => {
          totalWithdrawn += Number(withdrawal.amount || 0)
        })
      }

      const recalculatedBalance = Math.max(totalContributed - totalWithdrawn, 0)

      // Update group's current amount if it doesn't match
      if (Math.abs((contribution.current_amount || 0) - recalculatedBalance) > 0.01) {
        console.log(`Updating group amount from ${contribution.current_amount} to ${recalculatedBalance}`)
        await ContributionService.updateContributionGroup(contributionId, {
          current_amount: recalculatedBalance
        })
      }

      return await ContributionService.getContributionGroupById(contributionId)
    } catch (error) {
      console.error('Error syncing contribution data:', error)
      throw error
    }
  }

  // Sync all data for a user
  static async fullUserSync(userId: string) {
    try {
      console.log('Performing full sync for user:', userId)
      
      // Sync user data
      const updatedUser = await this.syncUserData(userId)
      
      // Get user's contribution groups
      const userContributions = await ContributionService.getUserContributionGroups(userId)
      
      // Sync each contribution group
      for (const contribution of userContributions) {
        await this.syncContributionData(contribution.id)
      }

      return updatedUser
    } catch (error) {
      console.error('Error performing full user sync:', error)
      throw error
    }
  }

  // Check for pending transactions and process them
  static async processPendingTransactions(userId: string) {
    try {
      const transactions = await TransactionService.getUserTransactions(userId)
      const pendingTransactions = transactions.filter(t => t.status === 'pending')

      for (const transaction of pendingTransactions) {
        // Check if transaction should be marked as completed
        // This would depend on your business logic
        console.log('Processing pending transaction:', transaction.id)
      }
    } catch (error) {
      console.error('Error processing pending transactions:', error)
    }
  }

  // Validate data integrity
  static async validateDataIntegrity(userId: string) {
    try {
      const user = await UserService.getUserById(userId)
      if (!user) return { valid: false, errors: ['User not found'] }

      const errors: string[] = []

      // Note: We no longer validate wallet balance against transactions
      // because the profiles.wallet_balance is the source of truth.
      // It's updated atomically by database functions during transactions.

      // Check contribution group consistency
      const userContributions = await ContributionService.getUserContributionGroups(userId)
      
      for (const contribution of userContributions) {
        const contributors = await ContributionService.getGroupContributors(contribution.id)
        const totalContributed = contributors.reduce((sum, c) => sum + Number((c as any).total_contributed || 0), 0)
        
        if (Math.abs((contribution.current_amount || 0) - totalContributed) > 0.01) {
          errors.push(`Group ${contribution.name} amount mismatch: stored=${contribution.current_amount}, calculated=${totalContributed}`)
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        user,
        currentBalance: user.wallet_balance || 0,
        contributions: userContributions
      }
    } catch (error) {
      console.error('Error validating data integrity:', error)
      return { valid: false, errors: ['Validation failed'] }
    }
  }
}