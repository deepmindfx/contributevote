import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceRequest {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  currencyCode: string;
  contractCode?: string;
  redirectUrl: string;
  groupId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const config = await getFlutterwaveConfig();
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const body: InvoiceRequest = await req.json();

    if (!body.amount || Number(body.amount) <= 0 || !body.customerEmail || !body.customerName || !body.paymentReference) {
      throw new Error('Missing required fields: amount, customerEmail, customerName, paymentReference');
    }

    const flutterwavePayload: Record<string, unknown> = {
      tx_ref: body.paymentReference,
      amount: Number(body.amount),
      currency: body.currencyCode || 'NGN',
      redirect_url: body.redirectUrl,
      customer: {
        email: body.customerEmail,
        name: body.customerName,
      },
      customizations: {
        title: "CollectiPay",
        description: body.paymentDescription || "CollectiPay payment",
        logo: "https://collectipay.com.ng/collectipay-mark.svg",
      },
      meta: {
        user_id: user.id,
        ...(body.groupId ? { group_id: body.groupId } : {}),
      },
    };

    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flutterwavePayload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('Flutterwave API error:', response.status, responseText);
      throw new Error(`Flutterwave API error: ${response.status}`);
    }

    const data = JSON.parse(responseText);
    const checkoutUrl = data?.data?.link;
    if (!checkoutUrl) {
      throw new Error('Flutterwave did not return a checkout link');
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        invoiceReference: body.paymentReference,
        paymentDescription: body.paymentDescription,
        amount: Number(body.amount),
        currencyCode: body.currencyCode || 'NGN',
        invoiceStatus: 'PENDING',
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        redirectUrl: body.redirectUrl,
        checkoutUrl,
        link: checkoutUrl,
        createdOn: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error creating invoice:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
