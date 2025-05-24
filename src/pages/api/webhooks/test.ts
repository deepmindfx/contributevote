import { NextApiRequest, NextApiResponse } from 'next';
import { handleWebhook } from '../../../services/flutterwave/webhooks';
import { WebhookData } from '../../../services/flutterwave/webhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed' 
    });
  }

  try {
    // For testing, we'll use a test signature
    const signature = 'MySuperSecretHashForCollectiPay#!';
    
    // Create a test webhook payload
    const testWebhookData: WebhookData = {
      event: 'charge.completed',
      data: {
        id: 123456789,
        tx_ref: 'TEST-' + Date.now(),
        flw_ref: 'TEST/FLW-' + Date.now(),
        amount: 1000,
        currency: 'NGN',
        status: 'successful',
        payment_type: 'card',
        created_at: new Date().toISOString(),
        customer: {
          id: 12345,
          name: 'Test User',
          email: 'test@example.com',
          phone_number: '+2341234567890',
          created_at: new Date().toISOString()
        },
        card: {
          first_6digits: '123456',
          last_4digits: '7890',
          issuer: 'TEST BANK',
          country: 'NG',
          type: 'VERVE',
          expiry: '12/25'
        }
      }
    };

    // Log the test webhook
    console.log('Testing webhook with payload:', {
      event: testWebhookData.event,
      tx_ref: testWebhookData.data.tx_ref,
      amount: testWebhookData.data.amount,
      currency: testWebhookData.data.currency
    });

    // Process the webhook
    const result = await handleWebhook(testWebhookData, signature);
    
    // Log the result
    console.log('Webhook test result:', result);

    return res.status(200).json({
      success: true,
      message: 'Test webhook processed',
      result
    });
  } catch (error) {
    console.error('Error processing test webhook:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error processing test webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 