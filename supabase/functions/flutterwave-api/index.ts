
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    
    if (req.method === 'POST' || req.method === 'PUT') {
      body = await req.json();
      console.log(`Request body for ${path}:`, JSON.stringify({
        ...body,
        bvn: body?.bvn ? '****' : undefined,
        phonenumber: body?.phonenumber ? '****' : undefined
      }));
    }
    
    // Validate Flutterwave secret key
    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error("Flutterwave secret key not configured");
    }
    
    switch (path) {
      case 'create-virtual-account':
        endpoint = '/virtual-account-numbers';
        method = 'POST';
        
        if (!body?.email) {
          return new Response(JSON.stringify({
            status: "error",
            message: "Email is required"
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!body?.firstname || !body?.lastname) {
          return new Response(JSON.stringify({
            status: "error",
            message: "First name and last name are required"
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return new Response(JSON.stringify({
            status: "error",
            message: "Invalid email format"
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (body.is_permanent === true && !body.bvn) {
          console.warn("Creating permanent account without BVN");
        }

        if (!body.tx_ref) {
          body.tx_ref = `VA_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        }
        break;
        
      case 'virtual-account-transactions':
        endpoint = '/virtual-account-numbers/transactions';
        method = 'GET';
        break;
        
      default:
        throw new Error(`Unknown endpoint: ${path}`);
    }
    
    console.log(`Making request to Flutterwave: ${FLUTTERWAVE_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}${endpoint}`, {
      method: method,
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`Flutterwave API response for ${path}: Success`);
      console.log(`Response status: ${response.status}`);
      console.log(`Response message: ${data.message || 'No message'}`);
      
      if (path === 'create-virtual-account' && data.data) {
        console.log(`Created account number: ${data.data.account_number || 'Not provided'}`);
        console.log(`Bank name: ${data.data.bank_name || 'Not provided'}`);
        console.log(`Reference: ${data.data.order_ref || 'Not provided'}`);
      }
    } else {
      console.error(`Flutterwave API error for ${path}:`, data);
      console.error(`Response status: ${response.status}`);
      console.error(`Error message: ${data.message || 'No error message'}`);
    }
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`Error in flutterwave-api function:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
