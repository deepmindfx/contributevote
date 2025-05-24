import { handleWebhook } from '../../../services/flutterwave/webhooks';
import type { WebhookData } from '../../../services/flutterwave/webhooks';
import type { Request, Response } from 'express';

export async function post(req: Request, res: Response) {
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
    console.log('Frontend received webhook:', {
      event: webhookData.event,
      tx_ref: webhookData.data.tx_ref,
      amount: webhookData.data.amount,
      currency: webhookData.data.currency,
      status: webhookData.data.status,
      customer: {
        email: webhookData.data.customer.email,
        name: webhookData.data.customer.name
      }
    });

    // Process the webhook
    const result = await handleWebhook(webhookData, signature);
    
    if (!result.success) {
      console.error('Frontend webhook processing failed:', result);
      return res.status(500).json(result);
    }

    // Log successful processing
    console.log('Webhook processed successfully:', {
      tx_ref: webhookData.data.tx_ref,
      result
    });

    // Return success response
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing webhook in frontend:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 