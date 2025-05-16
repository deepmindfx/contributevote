// Webhook handler for contribution transactions
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // Get the signature from the header
    const signature = event.headers['verif-hash'] || event.headers['Verif-Hash'];
    if (!signature) {
      console.error('No signature found in webhook');
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Unauthorized - No signature' })
      };
    }

    // Parse the webhook data
    const webhookData = JSON.parse(event.body);

    // Log the incoming webhook (without sensitive data)
    console.log('Received contribution webhook:', {
      event: webhookData.event,
      accountReference: webhookData.data?.accountReference,
      amount: webhookData.data?.amount,
      accountNumber: webhookData.data?.accountNumber,
      status: webhookData.data?.status
    });

    // Verify webhook signature (replace with your actual secret hash)
    const secretHash = process.env.FLW_SECRET_HASH_PROD;
    if (!secretHash || signature !== secretHash) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Invalid webhook signature' })
      };
    }

    // Process successful deposit to contribution account
    if (webhookData.event === 'virtual-account.credited' && webhookData.data?.status === 'successful') {
      const { 
        accountNumber, 
        amount, 
        bankName, 
        paymentReference,
        senderName,
        paymentDescription,
        narration
      } = webhookData.data;
      
      // Call the client-side endpoint to update localStorage
      // Get the app URL from environment or use a default
      const appUrl = process.env.APP_URL || 'http://localhost:8083';
      const clientEndpoint = `${appUrl}/api/webhook/contribution`;
      
      console.log(`Sending webhook to client endpoint: ${clientEndpoint}`);
      
      const response = await fetch(clientEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLIENT_SECRET || 'webhook_secret_token_12345'}`
        },
        body: JSON.stringify({
          type: 'contribution_received',
          data: {
            accountNumber,
            amount,
            bankName,
            paymentReference,
            senderName: senderName || 'Anonymous',
            paymentDescription: paymentDescription || narration || 'Contribution payment',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to update client:', await response.text());
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, message: 'Failed to update client' })
        };
      }

      console.log('Successfully processed contribution payment:', {
        accountNumber,
        amount,
        paymentReference
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Contribution payment processed successfully',
          data: {
            accountNumber,
            amount
          }
        })
      };
    }

    // Default response for other webhook events
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Webhook received but no action taken' })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
}; 