import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";
import { findSettledInbound, queueInboundReview } from "../_shared/verifiedInbound.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const { transaction_id, tx_ref, group_id } = await req.json();
    if (!/^\d{1,20}$/.test(String(transaction_id ?? ''))) {
      throw new Error('The payment return is missing a valid transaction ID.');
    }

    // Verify user profile exists and is active
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (profile.status && profile.status !== 'active') {
      throw new Error(`Your account is currently ${profile.status}.`);
    }

    // Verify transaction server-side with Flutterwave
    const { response: verifyRes } = await flutterwaveFetch(
      `/transactions/${encodeURIComponent(String(transaction_id))}/verify`,
      { method: 'GET', signal: AbortSignal.timeout(20_000) },
      config
    );

    if (!verifyRes.ok) {
      console.warn('Flutterwave checkout verification request failed', { status: verifyRes.status });
      throw new Error('Flutterwave couldn’t confirm this payment yet. Try verifying again.');
    }

    const verifyJson = await verifyRes.json();
    const flwData = verifyJson?.data;

    if (verifyJson?.status !== 'success' || flwData?.status !== 'successful' ||
      String(flwData?.id) !== String(transaction_id) || flwData?.currency !== 'NGN') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Flutterwave hasn’t confirmed this payment yet. If you paid, try verifying again shortly.',
        status: flwData?.status || 'failed',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (tx_ref && flwData.tx_ref && flwData.tx_ref !== tx_ref) {
      throw new Error('Transaction reference mismatch');
    }
    if (String(flwData.tx_ref || '').startsWith('CP_CHECKOUT_')) {
      const { data, error } = await supabaseAdmin.rpc('service_apply_checkout', {
        p_reference: flwData.tx_ref, p_provider_reference: String(flwData.id || ''),
        p_amount: Number(flwData.amount), p_currency: flwData.currency, p_method: flwData.payment_type || null,
        p_expected_user: user.id,
      });
      if (error || !data) throw new Error(error?.message || 'Checkout could not be confirmed.');
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (String(flwData.payment_type || "").toLowerCase() === "bank_transfer") {
      throw new Error("Bank deposits appear after the receiving account is confirmed by Flutterwave.");
    }
    const charge = { ...flwData, id: String(flwData.id), amount: Number(flwData.amount) };
    if (!Number.isFinite(charge.amount) || charge.amount < 0.01 || charge.amount > 9999999999999.99 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(flwData.amount))) throw new Error("Flutterwave returned an invalid payment amount.");
    const existing = await findSettledInbound(supabaseAdmin, charge, user.id);
    if (existing) {
      if (group_id && group_id !== existing.contributionId) throw new Error("Payment does not match a group checkout.");
      return Response.json({ success: true, alreadyProcessed: true, data: existing }, { headers: corsHeaders });
    }
    const email = String(flwData.customer?.email || "").trim().toLowerCase();
    if (!email || email !== user.email?.trim().toLowerCase()) throw new Error("Checkout could not be confirmed for this account.");
    await queueInboundReview(supabaseAdmin, charge, "missing_checkout_intent");
    return new Response(JSON.stringify({
      success: false, error: "Flutterwave confirmed the charge and CollectiPay needs to review it. Contact support with your payment reference.",
    }), {
      status: 409,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
