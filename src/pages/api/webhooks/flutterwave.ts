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
    // Get the signature from the header
    const signature = req.headers['verif-hash'] as string;
    if (!signature) {
      console.error('No signature found in webhook');
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized - No signature' 
      });
    }

    // Parse the webhook data
    const webhookData = req.body as WebhookData;
    
    // Log the incoming webhook (without sensitive data)
    console.log('Received webhook:', {
      event: webhookData.event,
      tx_ref: webhookData.data.tx_ref,
      amount: webhookData.data.amount,
      currency: webhookData.data.currency,
      status: webhookData.data.status
    });

    // Process the webhook
    const result = await handleWebhook(webhookData, signature);
    
    if (!result.success) {
      console.error('Webhook processing failed:', result);
      return res.status(500).json(result);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 