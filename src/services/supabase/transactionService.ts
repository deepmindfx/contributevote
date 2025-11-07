import { supabase } from '@/integrations/supabase/client'
import { Database } from '@/integrations/supabase/types'

type Transaction = Database['public']['Tables']['transactions']['Row']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export class TransactionService {
  // Get all transactions
  static async getTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!transactions_user_id_fkey(name, email),
        contribution_groups(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Get user transactions
  static async getUserTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!transactions_user_id_fkey(name, email),
        contribution_groups(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Get contribution transactions
  static async getContributionTransactions(contributionId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!transactions_user_id_fkey(name, email),
        contribution_groups(name)
      `)
      .eq('contribution_id', contributionId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Create transaction
  static async createTransaction(transactionData: TransactionInsert): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Update transaction
  static async updateTransaction(id: string, transactionData: TransactionUpdate): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(transactionData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Get transaction by reference ID
  static async getTransactionByReference(referenceId: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!transactions_user_id_fkey(name, email),
        contribution_groups(name)
      `)
      .eq('reference_id', referenceId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  // Delete transaction
  static async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // Get transaction statistics
  static async getTransactionStats(userId?: string) {
    let query = supabase
      .from('transactions')
      .select('type, amount, status')
    
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    
    if (error) throw error

    const stats = {
      totalTransactions: data?.length || 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalAmount: 0,
      successfulTransactions: 0
    }

    data?.forEach(transaction => {
      if (transaction.status === 'completed' || transaction.status === 'successful') {
        stats.successfulTransactions++
        stats.totalAmount += Number(transaction.amount)
        
        if (transaction.type === 'deposit') {
          stats.totalDeposits += Number(transaction.amount)
        } else if (transaction.type === 'withdrawal') {
          stats.totalWithdrawals += Number(transaction.amount)
        }
      }
    })

    return stats
  }
}