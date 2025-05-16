
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
    console.log('Webhook received at netlify function:', event.body);
    
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
    console.log('Processing Flutterwave webhook:', {
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

    // Process the webhook - we need to communicate with the browser to update localStorage
    // To do this in Netlify Functions, we can use the client-side storage API or broadcast a message
    
    // For now, acknowledge receipt of the webhook
    // The client application should poll for updates regularly
    
    // Store the transaction in a temporary storage or database if available
    // At minimum, log it clearly so we can see what's happening
    console.log('VALID TRANSACTION RECEIVED:', JSON.stringify({
      event: webhookData.event,
      amount: webhookData.data.amount,
      reference: webhookData.data.tx_ref,
      status: webhookData.data.status,
      customer: webhookData.data.customer,
      time: new Date().toISOString()
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Webhook received and validated',
        data: {
          event: webhookData.event,
          tx_ref: webhookData.data.tx_ref,
          amount: webhookData.data.amount
        }
      })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};
