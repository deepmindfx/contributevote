import { supabase } from '@/integrations/supabase/client'

export class WebhookTestService {
  // Test webhook with sample virtual account credit
  static async testVirtualAccountWebhook(userId: string, amount: number) {
    try {
      const webhookUrl = 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution'
      
      // Get user's virtual account
      const { data: user } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!user?.preferences?.virtualAccount?.accountNumber) {
        throw new Error('No virtual account found for user')
      }
      
      const testWebhookData = {
        type: 'virtual_account_credit',
        data: {
          account_number: user.preferences.virtualAccount.accountNumber,
          amount: amount,
          sender_name: 'Test Sender',
          sender_bank: 'Test Bank',
          payment_reference: `TEST_${Date.now()}`,
          transaction_reference: `TXN_${Date.now()}`,
          narration: 'Test webhook transaction'
        }
      }
      
      console.log('Sending test webhook:', testWebhookData)
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testWebhookData)
      })
      
      const result = await response.json()
      console.log('Webhook response:', result)
      
      return {
        success: response.ok,
        data: result,
        status: response.status
      }
    } catch (error) {
      console.error('Error testing webhook:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Test webhook with Flutterwave format
  static async testFlutterwaveWebhook(userEmail: string, amount: number) {
    try {
      const webhookUrl = 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution'
      
      const testWebhookData = {
        event: 'charge.completed',
        data: {
          tx_ref: `TEST_${Date.now()}`,
          flw_ref: `FLW_${Date.now()}`,
          amount: amount,
          currency: 'NGN',
          payment_type: 'card',
          status: 'successful',
          customer: {
            email: userEmail,
            name: 'Test User'
          }
        }
      }
      
      console.log('Sending test Flutterwave webhook:', testWebhookData)
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testWebhookData)
      })
      
      const result = await response.json()
      console.log('Webhook response:', result)
      
      return {
        success: response.ok,
        data: result,
        status: response.status
      }
    } catch (error) {
      console.error('Error testing Flutterwave webhook:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Check webhook function status
  static async checkWebhookStatus() {
    try {
      const webhookUrl = 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/webhook-contribution'
      
      const response = await fetch(webhookUrl, {
        method: 'GET'
      })
      
      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Webhook function is active' : 'Webhook function not responding'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Cannot reach webhook function'
      }
    }
  }
}