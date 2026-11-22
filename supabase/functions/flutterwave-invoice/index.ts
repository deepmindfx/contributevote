import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

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
  anonymous?: boolean;
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

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: profile } = await supabaseAdmin.from('profiles').select('status,preferences').eq('id', user.id).maybeSingle();
    if (!profile || (profile.status && profile.status !== 'active')) throw new Error('This account cannot start checkout.');
    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const body: InvoiceRequest = await req.json();

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 100 || !Number.isSafeInteger(Math.round(amount * 100)) ||
      Math.round(amount * 100) / 100 !== amount || !body.customerName || !user.email || (body.currencyCode && body.currencyCode !== 'NGN')) {
      throw new Error('Enter a valid amount of at least ₦100 and sign in with an email address.');
    }
    if (body.groupId) {
      const { data: group } = await supabaseAdmin.from('contribution_groups')
        .select('privacy,status,archived,creator_id').eq('id', body.groupId).maybeSingle();
      if (!group || group.status !== 'active' || group.archived) throw new Error('This group is not accepting contributions.');
      if (group.privacy !== 'public' && group.creator_id !== user.id) {
        const { data: membership } = await supabaseAdmin.from('contributors')
          .select('id').eq('group_id', body.groupId).eq('user_id', user.id).maybeSingle();
        if (!membership) throw new Error('Join this group before contributing.');
      }
    }
    const paymentReference = 'CP_CHECKOUT_' + crypto.randomUUID();
    const { error: intentError } = await supabaseAdmin.from('checkout_intents').insert({
      reference: paymentReference, user_id: user.id, group_id: body.groupId || null, amount,
      anonymous: Boolean(body.groupId) && (typeof body.anonymous === 'boolean'
        ? body.anonymous : profile.preferences?.anonymousContributions === true),
    });
    if (intentError) throw new Error('Could not start checkout.');

    const flutterwavePayload: Record<string, unknown> = {
      tx_ref: paymentReference,
      amount,
      currency: 'NGN',
      payment_options: 'card, banktransfer',
      redirect_url: body.redirectUrl,
      customer: {
        email: user.email,
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

    const { response } = await flutterwaveFetch(
      '/payments',
      { method: 'POST', body: flutterwavePayload },
      config
    );

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
        invoiceReference: paymentReference,
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
