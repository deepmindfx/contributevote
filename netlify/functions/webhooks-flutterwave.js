const crypto = require('crypto');
const fetch = require('node-fetch');

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
    console.log('Received webhook:', {
      event: webhookData.event,
      tx_ref: webhookData.data?.tx_ref,
      amount: webhookData.data?.amount,
      currency: webhookData.data?.currency,
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

    // Process successful charge completion
    if (webhookData.event === 'charge.completed' && webhookData.data?.status === 'successful') {
      const { tx_ref, amount } = webhookData.data;
      
      // Extract contribution ID from tx_ref
      // Format: COLL_<contributionId>_<timestamp>
      const [prefix, contributionId, timestamp] = tx_ref.split('_');
      
      if (prefix !== 'COLL' || !contributionId) {
        console.error('Invalid transaction reference format:', tx_ref);
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: 'Invalid transaction reference format' })
        };
      }

      // Call the client-side endpoint to update localStorage
      const clientEndpoint = process.env.CLIENT_ENDPOINT || 'http://localhost:3000/api/webhook';
      const response = await fetch(clientEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLIENT_SECRET}`
        },
        body: JSON.stringify({
          type: 'payment_success',
          data: {
            tx_ref,
            amount,
            contributionId,
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

      console.log('Successfully processed payment:', {
        contributionId,
        amount,
        tx_ref
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Webhook processed successfully' })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
}; 