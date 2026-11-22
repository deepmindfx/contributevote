import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

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

    const fee = numericAmount > 5000 ? 26.5 : 10.75;
    const totalAmount = Math.round((numericAmount + fee) * 100) / 100;

    // Atomically debit wallet via locked SQL RPC to eliminate race conditions / double-spend
    const { data: debitRes, error: debitError } = await supabaseAdmin.rpc(
      'service_adjust_wallet_balance',
      { p_user_id: user.id, p_delta: -totalAmount }
    );

    if (debitError || !debitRes?.success) {
      throw new Error(
        debitRes?.error === 'Insufficient wallet balance'
          ? `Insufficient balance. You need ₦${totalAmount.toFixed(2)} (₦${numericAmount} + ₦${fee} fee)`
          : debitRes?.error || 'Could not debit wallet for transfer'
      );
    }

    const balanceBefore = Number(debitRes.balance_before);
    const balanceAfter = Number(debitRes.balance_after);
    const reference = `TRF_${Date.now()}_${user.id.substring(0, 8)}`;

    const transferResponse = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank,
        account_number,
        amount: numericAmount,
        narration: narration || 'Transfer from CollectiPay',
        currency,
        reference,
        callback_url: config.webhookUrl,
        debit_currency: currency,
        beneficiary_name,
      }),
    });

    if (!transferResponse.ok) {
      const errorData = await transferResponse.text();
      console.error('Flutterwave transfer error:', errorData);
      // Atomic credit rollback — preserves any concurrent deposits!
      await supabaseAdmin.rpc('service_adjust_wallet_balance', {
        p_user_id: user.id,
        p_delta: totalAmount,
      });
      throw new Error('Transfer failed at payment provider. Your wallet was not charged.');
    }

    const transferData = await transferResponse.json();
    if (transferData.status !== 'success') {
      await supabaseAdmin.rpc('service_adjust_wallet_balance', {
        p_user_id: user.id,
        p_delta: totalAmount,
      });
      throw new Error(transferData.message || 'Transfer failed');
    }

    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'transfer',
        amount: numericAmount,
        status: transferData.data.status === 'SUCCESSFUL' ? 'completed' : 'pending',
        description: `Transfer to ${beneficiary_name} (${account_number})`,
        payment_method: 'bank_transfer',
        reference_id: reference,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        metadata: {
          account_number,
          account_bank,
          beneficiary_name,
          bank_name: transferData.data.bank_name || account_bank,
          narration: narration || '',
          fee,
          total_debited: totalAmount,
          flutterwave_id: transferData.data.id,
          flutterwave_reference: transferData.data.reference,
        },
      });

    if (transactionError) {
      console.error('Failed to create transaction record:', transactionError);
    }

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Transfer initiated successfully',
      data: {
        id: transferData.data.id,
        reference,
        amount: numericAmount,
        fee,
        status: transferData.data.status,
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
