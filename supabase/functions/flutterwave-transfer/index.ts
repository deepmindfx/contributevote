import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
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
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error('Flutterwave secret key not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: TransferRequest = await req.json();
    const { account_bank, account_number, amount, narration, currency, beneficiary_name } = body;

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    const balanceBefore = Number(profile.wallet_balance || 0);
    const fee = numericAmount > 5000 ? 26.5 : 10.75;
    const totalAmount = numericAmount + fee;

    if (balanceBefore < totalAmount) {
      throw new Error(`Insufficient balance. You need ₦${totalAmount.toFixed(2)} (₦${numericAmount} + ₦${fee} fee)`);
    }

    const reference = `TRF_${Date.now()}_${user.id.substring(0, 8)}`;

    // Deduct balance first with optimistic concurrency check to prevent double-spend
    const balanceAfter = balanceBefore - totalAmount;
    const { data: debitedProfile, error: debitError } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: balanceAfter, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .eq('wallet_balance', balanceBefore)
      .select('wallet_balance')
      .maybeSingle();

    if (debitError || !debitedProfile) {
      throw new Error('Wallet balance changed during transfer. Please try again.');
    }

    const transferResponse = await fetch(`${FLUTTERWAVE_BASE_URL}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank,
        account_number,
        amount: numericAmount,
        narration: narration || 'Transfer from CollectiPay',
        currency,
        reference,
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-contribution`,
        debit_currency: currency,
        beneficiary_name
      }),
    });

    if (!transferResponse.ok) {
      const errorData = await transferResponse.text();
      console.error('Flutterwave transfer error:', errorData);
      // Roll back wallet debit
      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balanceBefore, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      throw new Error('Transfer failed. Please try again.');
    }

    const transferData = await transferResponse.json();

    if (transferData.status !== 'success') {
      // Roll back wallet debit
      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balanceBefore, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      throw new Error(transferData.message || 'Transfer failed');
    }

    // Record transaction using the actual `metadata` column
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
          flutterwave_reference: transferData.data.reference
        }
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
        narration
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error processing transfer:', error);

    return new Response(JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
