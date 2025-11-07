import { supabase } from '@/integrations/supabase/client'

export class EdgeFunctionService {
  // Get Nigerian banks
  static async getBanks() {
    const { data, error } = await supabase.functions.invoke('flutterwave-banks')
    
    if (error) throw error
    return data
  }

  // Resolve bank account details
  static async resolveAccount(accountNumber: string, bankCode: string) {
    const { data, error } = await supabase.functions.invoke('flutterwave-resolve-account', {
      body: { account_number: accountNumber, bank_code: bankCode }
    })
    
    if (error) throw error
    return data
  }

  // Create virtual account
  static async createVirtualAccount(userData: {
    email: string
    tx_ref: string
    bvn: string
    narration: string
  }) {
    const { data, error } = await supabase.functions.invoke('flutterwave-virtual-account', {
      body: userData
    })
    
    if (error) throw error
    return data
  }

  // Get virtual account transactions
  static async getVirtualAccountTransactions(accountReference: string) {
    const { data, error } = await supabase.functions.invoke('flutterwave-transactions', {
      body: { account_reference: accountReference }
    })
    
    if (error) throw error
    return data
  }

  // Create payment invoice
  static async createPaymentInvoice(invoiceData: {
    amount: number
    customerName: string
    customerEmail: string
    paymentReference: string
    paymentDescription: string
    currencyCode: string
    contractCode: string
    redirectUrl: string
  }) {
    const { data, error } = await supabase.functions.invoke('flutterwave-invoice', {
      body: invoiceData
    })
    
    if (error) throw error
    return data
  }
}