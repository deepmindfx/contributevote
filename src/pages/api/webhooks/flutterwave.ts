import { NextApiRequest, NextApiResponse } from 'next';
import { handleWebhook } from '../../../services/flutterwave/webhooks';
import { SECRET_KEY } from '../../../services/flutterwave/config';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['verif-hash'];
    if (!signature) {
      console.error('No signature found in webhook');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify the signature
    const hash = crypto
      .createHmac('sha512', SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // Process the webhook
    await handleWebhook(req.body);

    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 