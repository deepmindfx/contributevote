
import type { NextApiRequest, NextApiResponse } from 'next';
import { handleWebhook } from '../../../services/flutterwave/webhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { amount = 5000, userId, tx_ref = `TEST_TX_${Date.now()}` } = req.body;

    // Create a simulated webhook payload
    const webhookPayload = {
      event: 'charge.completed',
      data: {
        id: Math.floor(Math.random() * 1000000),
        tx_ref: tx_ref,
        flw_ref: `FLW_${Math.floor(Math.random() * 1000000)}`,
        amount,
        currency: 'NGN',
        status: 'successful',
        payment_type: 'card',
        created_at: new Date().toISOString(),
        customer: {
          id: 1,
          name: 'Test Customer',
          email: 'test@example.com',
          phone_number: null,
          created_at: new Date().toISOString()
        },
        card: {
          first_6digits: '123456',
          last_4digits: '7890',
          issuer: 'TEST BANK',
          country: 'NG',
          type: 'VISA',
          expiry: '01/25'
        }
      }
    };

    console.log('Simulating charge.completed webhook:', webhookPayload);

    // Process the webhook as if it came from Flutterwave
    // Skip signature verification for testing
    const result = await handleWebhook(webhookPayload, 'test_signature');

    return res.status(200).json({
      status: 'success',
      message: 'Simulated webhook processed',
      result
    });
  } catch (error) {
    console.error('Error simulating webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
