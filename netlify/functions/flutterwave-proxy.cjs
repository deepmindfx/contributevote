const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the path from the request
    const path = event.path.replace('/api/flutterwave', '');
    
    // Get the request body
    const requestBody = JSON.parse(event.body);
    
    // Get the secret key from environment variables
    const secretKey = process.env.FLW_SECRET_KEY_PROD;
    
    // Add debug logging
    console.log('Environment variables:', {
      hasSecretKey: !!secretKey,
      secretKeyLength: secretKey ? secretKey.length : 0,
      path,
      method: event.httpMethod
    });
    
    if (!secretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Flutterwave API key not configured' })
      };
    }

    // Forward the request to Flutterwave
    const response = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Get the response data
    const data = await response.json();

    // Return the response
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error in Flutterwave proxy:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
}; 