import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  narration?: string;
  currency: string;
  beneficiary_name: string;
  transaction_pin?: string;
  expected_fee: number;
  attempt_id: string;
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.transfersEnabled) {
      throw new Error('Bank transfers are temporarily paused by platform administrators.');
    }
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key is not configured');
    }

    const body: TransferRequest = await req.json();
    const { account_bank, account_number, amount, narration, currency, beneficiary_name, transaction_pin } = body;

    if (!account_bank || !account_number || !amount || !currency || !beneficiary_name) {
      throw new Error('Missing required fields');
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      throw new Error('Minimum transfer amount is ₦100');
    }

    if (numericAmount > 500000) {
      throw new Error('Maximum transfer amount is ₦500,000');
    }

    // Fetch status, balance & transaction PIN and enforce account compliance + server-side PIN verification
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, status, preferences')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    if (profile.status && profile.status !== 'active') {
      throw new Error(`Your account is currently ${profile.status}. Outgoing transfers are disabled.`);
    }

    const storedPin = String((profile.preferences as Record<string, unknown> | null)?.transactionPin || '').trim();
    if (!/^\d{4}$/.test(storedPin)) {
      throw new Error('Please set up your 4-digit Transaction PIN in Security Settings before sending money.');
    }

    const suppliedPin = String(transaction_pin || '').trim();
    if (!/^\d{4}$/.test(suppliedPin) || suppliedPin !== storedPin) {
      throw new Error('Incorrect 4-digit Transaction PIN.');
    }

    if (currency !== 'NGN' || !Number.isFinite(body.expected_fee)) throw new Error('Review the transfer fee before sending.');
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.attempt_id || '')) throw new Error('Review this transfer again.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id + ':' + body.attempt_id.toLowerCase()));
    const reference = 'TRF_' + Array.from(new Uint8Array(digest, 0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc('service_reserve_priced_transfer', {
      p_user_id: user.id, p_reference: reference, p_amount: numericAmount, p_expected_fee: body.expected_fee,
      p_metadata: { account_number, account_bank, beneficiary_name, narration: narration || '' },
    });
    if (reserveError || !reserved?.success) throw new Error(reserveError?.message || reserved?.error || 'Could not reserve the transfer');
    const fee = Number(reserved.fee);
    if (reserved.replayed) {
      return new Response(JSON.stringify({
        status: 'success',
        data: {
          reference, amount: numericAmount, fee, fee_reason: reserved.fee_reason, status: reserved.status,
          created_at: reserved.created_at, full_name: beneficiary_name, account_number,
          bank_name: reserved.bank_name || account_bank, narration,
        },
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const settle = async (status: 'pending' | 'completed' | 'failed', details: Record<string, unknown>) => {
      const { data, error } = await supabaseAdmin.rpc('service_settle_priced_transfer', {
        p_reference: reference, p_status: status, p_details: details,
      });
      if (error || !data?.found) throw new Error('We couldn’t confirm the transfer. Check Wallet history before trying again.');
      return data.status as string;
    };

    const { response: transferResponse, routedViaStaticIp } = await flutterwaveFetch('/transfers', {
      method: 'POST',
      body: {
        account_bank, account_number, amount: numericAmount, beneficiary_name, reference, currency,
        debit_currency: currency, narration: narration || 'Transfer from CollectiPay', callback_url: config.webhookUrl,
      },
    }, config);

    // A timeout or provider server error can occur after acceptance. Keep the reserved payment pending.
    if (transferResponse.status >= 500 || transferResponse.status === 408) {
      throw new Error('The bank hasn’t confirmed this transfer yet. Check Wallet history before trying again.');
    }
    const transferData = await transferResponse.json().catch(() => null);
    if (!transferResponse.ok || transferData?.status === 'error') {
      await settle('failed', {});
      throw new Error(transferData?.message || 'The transfer failed and the wallet debit was refunded.');
    }
    if (!transferData?.data || transferData.status !== 'success') {
      throw new Error('The bank hasn’t confirmed this transfer yet. Check Wallet history before trying again.');
    }
    const providerStatus = String(transferData.data.status || '').toUpperCase();
    const settledStatus = await settle(providerStatus === 'SUCCESSFUL' ? 'completed' : providerStatus === 'FAILED' ? 'failed' : 'pending', {
      bank_name: transferData.data.bank_name || account_bank,
      flutterwave_id: transferData.data.id, flutterwave_reference: transferData.data.reference,
      routed_via_static_ip: routedViaStaticIp, static_ip: routedViaStaticIp ? config.staticIpAddress : null,
    });
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Transfer initiated successfully',
      data: {
        id: transferData.data.id,
        reference,
        amount: numericAmount,
        fee,
        status: settledStatus,
        fee_reason: reserved.fee_reason,
        created_at: new Date().toISOString(),
        full_name: beneficiary_name,
        account_number,
        bank_name: transferData.data.bank_name || account_bank,
        narration,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error processing transfer:', error);

    return new Response(JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
