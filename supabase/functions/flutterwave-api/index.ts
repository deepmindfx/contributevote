
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Load environment variables
const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY') || '';
const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

serve(async (req) => {
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Get the endpoint from the path (e.g. /flutterwave-api/create-virtual-account => create-virtual-account)
    const endpoint = pathParts[pathParts.length - 1];
    
    // Check if we have a secret key
    if (!FLUTTERWAVE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'FLUTTERWAVE_SECRET_KEY environment variable is not set' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Define request data
    let requestData;
    
    if (req.method !== 'GET') {
      requestData = await req.json();
    }
    
    console.log(`Processing ${endpoint} request:`, requestData);
    
    // Handle different endpoints
    switch (endpoint) {
      case 'create-virtual-account': 
        return await createVirtualAccount(requestData);
        
      case 'verify-transaction':
        return await verifyTransaction(requestData.transactionId);
        
      default:
        return new Response(
          JSON.stringify({ status: 'error', message: 'Endpoint not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
    
  } catch (error) {
    console.error('Error in Flutterwave API:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function createVirtualAccount(data: any) {
  try {
    const response = await fetch(`${FLUTTERWAVE_API_URL}/virtual-account-numbers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: data.email,
        is_permanent: data.is_permanent,
        bvn: data.bvn,
        nin: data.nin,
        tx_ref: data.tx_ref,
        phonenumber: data.phonenumber,
        firstname: data.firstname,
        lastname: data.lastname,
        narration: data.narration,
        currency: 'NGN',
      })
    });
    
    const result = await response.json();
    
    console.log('Flutterwave create virtual account response:', result);
    
    if (response.ok) {
      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: result.message || 'Failed to create virtual account' 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error creating virtual account:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message || 'Error creating virtual account' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function verifyTransaction(transactionId: string) {
  try {
    const response = await fetch(`${FLUTTERWAVE_API_URL}/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    console.log('Flutterwave verify transaction response:', result);
    
    if (response.ok) {
      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: result.message || 'Failed to verify transaction' 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message || 'Error verifying transaction' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
