import { supabase } from '@/integrations/supabase/client';

const getWebhookUrl = () => {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://sivvjwffekhfabgxhbcd.supabase.co';
  return `${supabaseUrl}/functions/v1/webhook-contribution`;
};

export class WebhookTestService {
  // Test webhook with sample virtual account credit
  static async testVirtualAccountWebhook(userId: string, amount: number) {
    try {
      const webhookUrl = getWebhookUrl();

      const { data: user } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const preferences = user?.preferences as any;
      if (!preferences?.virtualAccount?.accountNumber) {
        throw new Error('No virtual account found for user');
      }

      const testWebhookData = {
        type: 'virtual_account_credit',
        data: {
          account_number: preferences.virtualAccount.accountNumber,
          amount,
          sender_name: 'Test Sender',
          sender_bank: 'Test Bank',
          payment_reference: `TEST_${Date.now()}`,
          transaction_reference: `TXN_${Date.now()}`,
          narration: 'Test webhook transaction',
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWebhookData),
      });

      const result = await response.json();
      return { success: response.ok, data: result, status: response.status };
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Test webhook with Flutterwave format
  static async testFlutterwaveWebhook(userEmail: string, amount: number) {
    try {
      const webhookUrl = getWebhookUrl();

      const testWebhookData = {
        event: 'charge.completed',
        data: {
          tx_ref: `TEST_${Date.now()}`,
          flw_ref: `FLW_${Date.now()}`,
          amount,
          currency: 'NGN',
          payment_type: 'card',
          status: 'successful',
          customer: {
            email: userEmail,
            name: 'Test User',
          },
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWebhookData),
      });

      const result = await response.json();
      return { success: response.ok, data: result, status: response.status };
    } catch (error: any) {
      console.error('Error testing Flutterwave webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Check webhook function status
  static async checkWebhookStatus() {
    try {
      const webhookUrl = getWebhookUrl();
      const response = await fetch(webhookUrl, { method: 'GET' });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Webhook function is active' : 'Webhook function not responding',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Cannot reach webhook function',
      };
    }
  }
}
