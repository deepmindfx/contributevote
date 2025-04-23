
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY') || 'FLWSECK-85d93895f84a5bd92b7fbad3e211fd76-1965a626b3cvt-X';
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (!path) {
      throw new Error("Endpoint not specified");
    }

    let endpoint = '';
    let method = 'GET';
    let body = null;
    
    // Extract the request body if present
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await req.json();
    }
    
    // Determine the endpoint and HTTP method based on the path
    switch (path) {
      case 'create-virtual-account':
        endpoint = '/virtual-account-numbers';
        method = 'POST';
        break;
      case 'virtual-account-transactions':
        endpoint = '/virtual-account-numbers/transactions';
        method = 'GET';
        break;
      case 'initiate-payment':
        endpoint = '/payments';
        method = 'POST';
        break;
      default:
        throw new Error(`Unknown endpoint: ${path}`);
    }
    
    console.log(`Proxying request to Flutterwave: ${FLUTTERWAVE_BASE_URL}${endpoint}`);
    
    // Make the request to Flutterwave API
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}${endpoint}`, {
      method: method,
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    // Get the response data
    const data = await response.json();
    
    // Return the response with CORS headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`Error in flutterwave-api function:`, error);
    
    // Return the error response with CORS headers
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || 'An error occurred while processing your request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
