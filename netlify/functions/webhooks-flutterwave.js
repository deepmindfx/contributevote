const crypto = require('crypto');

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

    // TODO: Implement your webhook processing logic here
    // For now, just acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Webhook received' })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
}; 