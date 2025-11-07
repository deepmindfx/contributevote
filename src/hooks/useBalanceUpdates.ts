import { useEffect } from 'react'
import { useSupabaseUser } from '@/contexts/SupabaseUserContext'
import { WalletService } from '@/services/supabase/walletService'

export function useBalanceUpdates() {
  const { user, refreshCurrentUser } = useSupabaseUser()

  useEffect(() => {
    if (!user?.id) return

    // Check for balance updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        // Check for new transactions
        await WalletService.checkForNewTransactions(user.id)
        
        // Refresh user data to get updated balance
        await refreshCurrentUser()
      } catch (error) {
        console.error('Error checking for balance updates:', error)
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [user?.id, refreshCurrentUser])

  // Manual refresh function
  const refreshBalance = async () => {
    if (!user?.id) return

    try {
      await WalletService.checkForNewTransactions(user.id)
      await refreshCurrentUser()
    } catch (error) {
      console.error('Error refreshing balance:', error)
    }
  }

  return { refreshBalance }
}