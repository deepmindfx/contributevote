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
  contractCode?: string;
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
    
    console.log('Received request body:', JSON.stringify(body, null, 2));
    console.log('FLUTTERWAVE_SECRET_KEY exists:', !!FLUTTERWAVE_SECRET_KEY);
    
    if (!body.amount || !body.customerEmail || !body.customerName || !body.paymentReference) {
      const missingFields = [];
      if (!body.amount) missingFields.push('amount');
      if (!body.customerEmail) missingFields.push('customerEmail');
      if (!body.customerName) missingFields.push('customerName');
      if (!body.paymentReference) missingFields.push('paymentReference');
      
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Create payment link with Flutterwave
    const flutterwavePayload = {
      tx_ref: body.paymentReference,
      amount: body.amount,
      currency: body.currencyCode || 'NGN',
      redirect_url: body.redirectUrl,
      customer: {
        email: body.customerEmail,
        name: body.customerName
      },
      customizations: {
        title: "CollectiPay Contribution",
        description: body.paymentDescription || "Group contribution payment",
        logo: "https://collectipay.vercel.app/logo.png"
      }
    };

    console.log('Sending to Flutterwave:', JSON.stringify(flutterwavePayload, null, 2));

    // Use Flutterwave Standard Payment API
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flutterwavePayload),
    });

    const responseText = await response.text();
    console.log('Flutterwave API response status:', response.status);
    console.log('Flutterwave API response:', responseText);

    if (!response.ok) {
      console.error('Flutterwave API error status:', response.status);
      console.error('Flutterwave API error response:', responseText);
      throw new Error(`Flutterwave API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    // Map Flutterwave response to expected format
    return new Response(JSON.stringify({
      success: true,
      data: {
        invoiceReference: body.paymentReference,
        paymentDescription: body.paymentDescription,
        amount: body.amount,
        currencyCode: body.currencyCode,
        invoiceStatus: 'PENDING',
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        redirectUrl: body.redirectUrl,
        checkoutUrl: data.data.link,
        createdOn: new Date().toISOString()
      }
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