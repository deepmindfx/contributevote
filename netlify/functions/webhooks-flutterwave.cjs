const crypto = require('crypto');
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  console.log('Webhook received:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  });

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
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

    // Parse the request body
    const payload = JSON.parse(event.body);
    console.log('Parsed payload:', payload);

    // Verify the event type
    if (payload.event !== 'charge.completed') {
      console.log('Ignoring non-charge.completed event:', payload.event);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event ignored' })
      };
    }

    // Extract transaction details
    const transaction = payload.data;
    console.log('Transaction details:', {
      id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer: transaction.customer
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
    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      const { tx_ref, amount } = payload.data;
      
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

    // Store transaction in localStorage (this will be handled by the client)
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook processed successfully',
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          customer: transaction.customer
        }
      })
    };

    console.log('Sending response:', response);
    return response;

  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 