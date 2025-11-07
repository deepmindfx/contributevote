import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

interface InvoiceRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  currencyCode: string;
  contractCode: string;
  redirectUrl: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error('Flutterwave secret key not configured');
    }

    const body: InvoiceRequest = await req.json();
    
    if (!body.amount || !body.customerEmail || !body.customerName || !body.paymentReference) {
      throw new Error('Missing required fields: amount, customerEmail, customerName, paymentReference');
    }

    // Create invoice with Flutterwave
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: body.amount,
        customer_name: body.customerName,
        customer_email: body.customerEmail,
        payment_reference: body.paymentReference,
        payment_description: body.paymentDescription,
        currency_code: body.currencyCode,
        contract_code: body.contractCode,
        redirect_url: body.redirectUrl
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Flutterwave API error:', errorData);
      throw new Error(`Flutterwave API error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      data: data.data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});