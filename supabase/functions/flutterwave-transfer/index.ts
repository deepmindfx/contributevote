import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

import { reconcileBankTransfer, rememberPayoutId, transferReconciliationFields } from "../_shared/reconcileBankTransfer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  account_bank: string;
  bank_name?: string;
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
    if (userError || !user?.email_confirmed_at) {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    const body: TransferRequest & { action?: string; reference?: string } = await req.json();
    if (body.action === 'status') {
      const reference = String(body.reference || '');
      if (!/^TRF_[a-z0-9_]{8,90}$/i.test(reference)) throw new Error('Invalid transfer reference');
      const { data: row, error } = await supabaseAdmin.from('transactions').select(transferReconciliationFields)
        .eq('type', 'transfer').eq('user_id', user.id).eq('reference_id', reference).maybeSingle();
      if (error || !row) throw new Error('Transfer is unavailable');
      let status = row.status;
      if (status === 'pending' && Date.now() - Date.parse(row.updated_at || row.created_at) > 20_000) {
        status = await reconcileBankTransfer(supabaseAdmin, row, config).catch(() => row.status);
      }
      return new Response(JSON.stringify({ status }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!config.transfersEnabled) {
      throw new Error('Bank transfers are temporarily paused by platform administrators.');
    }
    if (!config.secretKey) {
      throw new Error('Flutterwave secret key is not configured');
    }

    const { account_bank, bank_name, account_number, amount, narration, currency, beneficiary_name, transaction_pin } = body;
    const cleanBankName = typeof bank_name === 'string' ? bank_name.trim().slice(0, 120) : '';

    if (typeof account_number !== 'string' || !/^\d{10}$/.test(account_number)
      || typeof account_bank !== 'string' || !/^[a-z0-9]{2,12}$/i.test(account_bank)
      || typeof beneficiary_name !== 'string' || !beneficiary_name.trim() || beneficiary_name.length > 120
      || (narration != null && (typeof narration !== 'string' || narration.length > 120))) {
      throw new Error('Review the bank account details before sending.');
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      throw new Error('Minimum transfer amount is ₦100');
    }

    if (numericAmount > 500000) {
      throw new Error('Maximum transfer amount is ₦500,000');
    }

    if (currency !== 'NGN' || !Number.isFinite(body.expected_fee)) throw new Error('Review the transfer fee before sending.');
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.attempt_id || '')) throw new Error('Review this transfer again.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id + ':' + body.attempt_id.toLowerCase()));
    const reference = 'TRF_' + Array.from(new Uint8Array(digest, 0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc('service_authorize_bank_transfer', {
      p_user_id: user.id, p_reference: reference, p_amount: numericAmount, p_expected_fee: body.expected_fee,
      p_metadata: {
        account_number,
        account_bank,
        ...(cleanBankName ? { bank_name: cleanBankName } : {}),
        beneficiary_name,
        narration: narration || '',
        dispatch_guard: true,
      },
      p_pin: typeof transaction_pin === 'string' ? transaction_pin : null,
    });
    if (reserveError || !reserved?.success) throw new Error(reserveError?.message || reserved?.error || 'Could not reserve the transfer');
    const fee = Number(reserved.fee);
    const transferReceipt = (status: string, transactionId?: string) =>
      new Response(JSON.stringify({
        status: 'success',
        data: {
          id: transactionId, reference, amount: numericAmount, fee, fee_reason: reserved.fee_reason, status,
          created_at: reserved.created_at || new Date().toISOString(), full_name: beneficiary_name, account_number,
          bank_name: reserved.bank_name || cleanBankName || account_bank, narration,
        },
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const currentReceipt = async (fallbackStatus = 'pending') => {
      const { data } = await supabaseAdmin.from('transactions').select('id,status')
        .eq('user_id', user.id).eq('reference_id', reference).maybeSingle();
      return transferReceipt(data?.status || fallbackStatus, data?.id);
    };

    if (reserved.replayed && reserved.status !== 'pending') return await currentReceipt(reserved.status);
    const { data: claimed } = await supabaseAdmin.rpc('service_claim_transfer_dispatch', {
      p_reference: reference, p_user_id: user.id,
    });
    if (!claimed) return await currentReceipt();

    const submitted = await flutterwaveFetch('/transfers', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      body: {
        account_bank, account_number, amount: numericAmount, beneficiary_name, reference, currency,
        debit_currency: currency, narration: narration || 'Transfer from CollectiPay', callback_url: config.webhookUrl,
      },
    }, config).catch(() => null);
    if (submitted?.response.ok) {
      const acknowledgement = await submitted.response.json().catch(() => null);
      if (acknowledgement?.status === "success") {
        await rememberPayoutId(supabaseAdmin, {
          user_id: user.id, reference_id: reference, amount: numericAmount, status: "pending",
          created_at: reserved.created_at, metadata: { account_bank, account_number },
        }, acknowledgement.data).catch(() => {});
      }
    } else {
      await submitted?.response.body?.cancel().catch(() => {});
    }

    // A response may be lost after acceptance. Only reconciliation can settle this debit.
    return await currentReceipt();
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
