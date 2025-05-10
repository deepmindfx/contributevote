import { NextApiRequest, NextApiResponse } from 'next';
import { handleWebhook } from '../../../services/flutterwave/webhooks';
// import { SECRET_KEY } from '../../../services/flutterwave/config'; // Remove this import
import crypto from 'crypto';

// Define the secret key here for server-side use only
const SECRET_KEY = process.env.FLW_SECRET_HASH || 'mySuperSecretHash2024!';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed' 
    });
  }

  try {
    console.log('Received webhook request:', {
      headers: req.headers,
      body: req.body
    });

    // --- Signature verification temporarily disabled for testing ---
    // const signature = req.headers['verif-hash'];
    // if (!signature) {
    //   console.error('No signature found in webhook');
    //   return res.status(401).json({ 
    //     success: false,
    //     message: 'Unauthorized - No signature' 
    //   });
    // }
    // const hash = crypto
    //   .createHmac('sha512', SECRET_KEY)
    //   .update(JSON.stringify(req.body))
    //   .digest('hex');
    // if (hash !== signature) {
    //   console.error('Invalid webhook signature');
    //   return res.status(401).json({ 
    //     success: false,
    //     message: 'Unauthorized - Invalid signature' 
    //   });
    // }
    // --- End of temporary disable ---

    // Process the webhook
    const result = await handleWebhook(req.body);
    
    if (!result.success) {
      console.error('Webhook processing failed:', result);
      return res.status(500).json(result);
    }

    console.log('Webhook processed successfully:', result);
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