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
    let webhookData;
    try {
      webhookData = JSON.parse(event.body);
      console.log('Full webhook data:', JSON.stringify(webhookData, null, 2));
    } catch (parseError) {
      console.error('Error parsing webhook data:', parseError);
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Invalid webhook data format' })
      };
    }

    // Verify webhook signature
    const secretHash = process.env.FLW_SECRET_HASH_PROD;
    if (!secretHash || signature !== secretHash) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Invalid webhook signature' })
      };
    }

    // Normalize webhook data structure
    const normalizedData = {
      event: webhookData.event,
      data: {
        id: webhookData.id || webhookData.data?.id,
        tx_ref: webhookData.tx_ref || webhookData.data?.tx_ref,
        flw_ref: webhookData.flw_ref || webhookData.data?.flw_ref,
        amount: webhookData.amount || webhookData.data?.amount,
        currency: webhookData.currency || webhookData.data?.currency,
        status: webhookData.status || webhookData.data?.status,
        payment_type: webhookData.payment_type || webhookData.data?.payment_type,
        created_at: webhookData.created_at || webhookData.data?.created_at || new Date().toISOString(),
        customer: webhookData.customer || webhookData.data?.customer || {
          id: 0,
          name: 'Anonymous',
          email: 'anonymous@example.com',
          phone_number: null,
          created_at: new Date().toISOString()
        }
      }
    };

    console.log('Normalized webhook data:', JSON.stringify(normalizedData, null, 2));

    // Process successful charge completion
    if (normalizedData.event === 'charge.completed' && normalizedData.data.status === 'successful') {
      try {
        // Get the frontend URL from environment variable or determine based on context
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = isProduction 
          ? 'https://collectipay.com.ng'
          : process.env.APP_URL || 'http://localhost:8080';
        
        // Forward the webhook to the frontend
        const webhookEndpoint = `${frontendUrl}/api/webhooks/flutterwave`;
        console.log('Forwarding webhook to frontend:', webhookEndpoint);
        
        const response = await fetch(webhookEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Verif-Hash': secretHash,
            'Origin': frontendUrl,
            'Accept': 'application/json'
          },
          body: JSON.stringify(normalizedData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to forward webhook to frontend:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            url: webhookEndpoint,
            requestBody: normalizedData
          });
          throw new Error(`Failed to forward webhook: ${errorText}`);
        }

        const result = await response.json();
        console.log('Frontend webhook processing result:', result);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Webhook processed successfully',
            result
          })
        };
      } catch (error) {
        console.error('Error forwarding webhook to frontend:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            message: 'Failed to forward webhook to frontend',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        };
      }
    } else {
      console.log('Unhandled webhook event or status:', {
        event: normalizedData.event,
        status: normalizedData.data.status
      });
    }

    // For other event types, just acknowledge receipt
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Webhook received',
        event: normalizedData.event,
        status: normalizedData.data.status
      })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 