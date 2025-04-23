
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Flutterwave API base URL
const FLUTTERWAVE_API_BASE = "https://api.flutterwave.com/v3";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Extract the specific endpoint from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const endpoint = pathParts.length > 2 ? pathParts[2] : '';
    
    // Get Flutterwave API key from environment variables
    const apiKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!apiKey) {
      throw new Error("FLUTTERWAVE_SECRET_KEY is not set in the environment");
    }

    // Handle different endpoint types
    let flutterwaveResponse;
    
    if (endpoint === "create-virtual-account") {
      // Extract request body
      const requestData = await req.json();
      console.log("Create virtual account request:", requestData);
      
      // Make request to Flutterwave API
      flutterwaveResponse = await fetch(`${FLUTTERWAVE_API_BASE}/virtual-account-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          email: requestData.email,
          is_permanent: requestData.is_permanent,
          bvn: requestData.bvn,
          nin: requestData.nin,
          tx_ref: requestData.tx_ref,
          narration: requestData.narration,
          phonenumber: requestData.phonenumber,
          firstname: requestData.firstname,
          lastname: requestData.lastname,
          currency: requestData.currency || "NGN",
          amount: requestData.amount
        })
      });
      
    } else if (endpoint === "verify-transaction") {
      const requestData = await req.json();
      const transactionId = requestData.transactionId;
      
      flutterwaveResponse = await fetch(`${FLUTTERWAVE_API_BASE}/transactions/${transactionId}/verify`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }
      });
      
    } else if (endpoint === "get-transactions") {
      const accountReference = url.searchParams.get('account_reference');
      
      if (!accountReference) {
        throw new Error("Account reference is required");
      }
      
      flutterwaveResponse = await fetch(`${FLUTTERWAVE_API_BASE}/virtual-account/transactions?account_reference=${accountReference}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }
      });
      
    } else if (endpoint === "payment-link") {
      const requestData = await req.json();
      console.log("Create payment link request:", requestData);
      
      flutterwaveResponse = await fetch(`${FLUTTERWAVE_API_BASE}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          tx_ref: requestData.tx_ref || `FLW-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          amount: requestData.amount,
          currency: requestData.currency || "NGN",
          redirect_url: requestData.redirect_url || "https://collectipay.app/payment-callback",
          customer: {
            email: requestData.customer_email,
            name: requestData.customer_name
          },
          customizations: {
            title: requestData.title || "CollectiPay Payment",
            description: requestData.description || "Fund your wallet",
            logo: requestData.logo || "https://collectipay.app/logo.png"
          },
          meta: requestData.meta || {}
        })
      });
      
    } else {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    // Process Flutterwave API response
    const responseData = await flutterwaveResponse.json();
    
    console.log("Flutterwave API response:", responseData);

    // Return the response with CORS headers
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: flutterwaveResponse.status
    });
    
  } catch (error) {
    console.error("Error in Flutterwave Edge Function:", error.message);
    
    return new Response(JSON.stringify({
      status: "error",
      message: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
