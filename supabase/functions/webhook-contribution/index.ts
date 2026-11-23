import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  FLUTTERWAVE_BASE_URL,
  getFlutterwaveConfig,
  type FlutterwaveRuntimeConfig,
} from "../_shared/flutterwaveConfig.ts";

import { findMatchingProviderIds, reconcileBankTransfer, transferReconciliationFields } from "../_shared/reconcileBankTransfer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash'
};

const GENERIC_SENDER_NAMES = new Set([
  'anonymous',
  'anonymous customer',
  'unknown',
  'unknown customer',
  'unknown sender',
  'customer',
  'n/a',
  'null',
  'undefined',
]);

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanSenderName(value: unknown): string | null {
  const str = cleanString(value);
  if (!str) return null;
  if (GENERIC_SENDER_NAMES.has(str.toLowerCase())) return null;
  return str;
}

function maskAccountNumber(acc?: string | null): string | null {
  if (!acc) return null;
  const clean = String(acc).trim();
  if (!clean) return null;
  if (clean.includes('*')) return clean;
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
}

async function fetchVerifiedCharge(
  transactionId: string | number | undefined,
  flwConfig?: FlutterwaveRuntimeConfig
): Promise<Record<string, any> | null> {
  if (!transactionId || !flwConfig?.secretKey) return null;
  try {
    const res = await fetch(
      `${FLUTTERWAVE_BASE_URL}/transactions/${encodeURIComponent(String(transactionId))}/verify`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${flwConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const charge = json?.data;
    if (json?.status === "success" && charge?.status === "successful" && charge?.currency === "NGN"
      && String(charge.id) === String(transactionId)) return charge;
    return null;
  } catch (err) {
    console.warn('Non-fatal: could not enrich originator details from Flutterwave verify:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook endpoint is active'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      message: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Strictly verify Flutterwave webhook signature using Super Admin Gateway Settings (DB first, env fallback)
    const signature = req.headers.get('verif-hash');
    const flwConfig = await getFlutterwaveConfig({ supabaseAdmin: supabase });
    const expectedHash = flwConfig.webhookHash;

    if (!expectedHash) {
      console.error('Webhook secret hash is not configured in Gateway Settings or environment secrets');
      return new Response(JSON.stringify({
        success: false,
        message: 'Webhook secret hash not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503
      });
    }

    if (!signature || signature !== expectedHash) {
      console.error('Invalid or missing webhook signature');
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid signature'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const webhookData = await req.json();
    console.log('Received webhook event:', webhookData.event || webhookData.type);

    if (webhookData.event) {
      return await handleFlutterwaveWebhook(supabase, webhookData, flwConfig);
    }

    const { type, data } = webhookData;
    if (type === 'contribution_received' && data) {
      return await handleContributionWebhook(supabase, data);
    }

    if (type === 'virtual_account_credit' && data) {
      return await handleVirtualAccountCredit(supabase, data, webhookData.meta_data);
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'Unknown webhook type'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Server error processing webhook'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function handleFlutterwaveWebhook(
  supabase: any,
  webhookData: any,
  flwConfig?: FlutterwaveRuntimeConfig
) {
  const { event, data } = webhookData;
  const topLevelMeta = webhookData.meta_data || webhookData.meta || null;

  if (event === 'charge.completed' && data) {
    if (data.status && data.status.toLowerCase() !== 'successful') {
      return new Response(JSON.stringify({
        success: true,
        message: `Ignored non-successful charge status: ${data.status}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    return await handleSuccessfulPayment(supabase, data, topLevelMeta, flwConfig);
  }

  if (event === 'transfer.completed' && data && flwConfig) {
    return handleOutboundTransferCallback(supabase, data, flwConfig);
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Webhook received but not processed',
    event
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200
  });
}

async function handleOutboundTransferCallback(supabase: any, transferData: any, config: FlutterwaveRuntimeConfig) {
  const reference = transferData.reference;
  if (typeof reference === "string" && reference.startsWith("TRF_")) {
    const { data: row, error } = await supabase.from("transactions").select(transferReconciliationFields)
      .eq("type", "transfer").eq("reference_id", reference).maybeSingle();
    if (error) throw error;
    if (row?.metadata?.dispatched_at) {
      const [recordId] = findMatchingProviderIds(row, [transferData]);
      await reconcileBankTransfer(supabase, row, config, { recordId });
    }
  }
  return paymentResponse({ received: true });
}

async function handleSuccessfulPayment(
  supabase: any,
  paymentData: any,
  topLevelMeta?: Record<string, any> | null,
  flwConfig?: FlutterwaveRuntimeConfig
) {
  const verified = await fetchVerifiedCharge(paymentData.id, flwConfig);
  if (!verified) throw new Error("Flutterwave has not confirmed this payment.");
  const checkoutReference = String(verified.tx_ref || "");
  if (checkoutReference.startsWith("CP_CHECKOUT_")) {
    const { data, error } = await supabase.rpc("service_apply_checkout", {
      p_reference: checkoutReference, p_provider_reference: String(verified.id),
      p_amount: Number(verified.amount), p_currency: verified.currency, p_method: verified.payment_type || null,
    });
    if (error || !data) throw error || new Error("Checkout could not be confirmed");
    return paymentResponse(data);
  }

  const meta = { ...topLevelMeta, ...paymentData.meta_data, ...paymentData.meta, ...verified.meta };
  const method = String(verified.payment_type || "card").toLowerCase();
  const providerRef = String(verified.flw_ref || verified.id);
  const destination = cleanString(meta.virtualaccountnumber || meta.virtual_account_number || meta.accountNumber
    || meta.account_number || paymentData.account_number || verified.account_number);
  if (method === "bank_transfer" && destination && /^\d{10}$/.test(destination)) {
    return handleVirtualAccountCredit(supabase, {
      account_number: destination, currency: verified.currency, amount: verified.amount,
      payment_reference: providerRef, id: verified.id,
      sender_name: meta.originatorname || verified.customer?.name, sender_bank: meta.bankname,
      originator_account_number: meta.originatoraccountnumber,
    });
  }

  const email = String(verified.customer?.email || "").trim().toLowerCase();
  const { data: user } = email
    ? await supabase.from("profiles").select("id").eq("email", email).maybeSingle()
    : { data: null };
  if (!user || (meta.user_id && meta.user_id !== user.id)) {
    throw new Error("Flutterwave could not match this payment to a CollectiPay account.");
  }
  const groupId = verified.meta?.user_id === user.id ? verified.meta?.group_id : null;
  if ((checkoutReference.startsWith("GROUP_") || meta.group_id) && !groupId) {
    throw new Error("The group payment needs a confirmed bank account or checkout.");
  }
  const { data, error } = await supabase.rpc("service_apply_verified_inbound", {
    p_user_id: user.id, p_group_id: groupId || null, p_reference: providerRef, p_provider_id: String(verified.id),
    p_amount: Number(verified.amount), p_currency: verified.currency, p_method: method, p_destination: null,
    p_metadata: {
      senderName: cleanSenderName(meta.originatorname || verified.customer?.name),
      senderBank: cleanString(meta.bankname || method),
      senderAccount: maskAccountNumber(meta.originatoraccountnumber), txRef: checkoutReference,
    },
  });
  if (error || !data) throw error || new Error("Payment could not be credited.");
  return paymentResponse(data);
}

function paymentResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGroupAccountCredit(supabase: any, group: any, creditData: any) {
  const reference = creditData.payment_reference || creditData.transaction_reference || creditData.reference || creditData.id;
  const { data, error } = await supabase.rpc('service_record_outside_group_payment', {
    p_group_id: group.id, p_reference: String(reference || ''), p_amount: Number(creditData.amount),
    p_sender_name: cleanSenderName(creditData.sender_name || creditData.senderName),
    p_sender_bank: cleanString(creditData.sender_bank || creditData.bankName),
    p_metadata: {
      senderAccount: maskAccountNumber(creditData.originator_account_number || creditData.sender_account),
      accountNumber: creditData.account_number || creditData.accountNumber || group.account_number,
      narration: creditData.narration,
    },
  });
  if (error || !data) throw error || new Error('Group transfer could not be recorded');
  return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleVirtualAccountCredit(
  supabase: any,
  creditData: any,
  topLevelMeta?: Record<string, any> | null
) {
  const mergedCredit = {
    ...(topLevelMeta && typeof topLevelMeta === 'object' ? topLevelMeta : {}),
    ...(creditData || {}),
    sender_name:
      cleanSenderName(
        creditData?.sender_name ||
          creditData?.senderName ||
          creditData?.originatorname ||
          topLevelMeta?.originatorname
      ) || undefined,
    sender_bank:
      cleanString(
        creditData?.sender_bank ||
          creditData?.bankName ||
          creditData?.bankname ||
          topLevelMeta?.bankname
      ) || undefined,
    originator_account_number:
      cleanString(
        creditData?.originator_account_number ||
          creditData?.sender_account ||
          creditData?.originatoraccountnumber ||
          topLevelMeta?.originatoraccountnumber
      ) || undefined,
  };

  const accountNumber = mergedCredit.account_number || mergedCredit.accountNumber;
  if (!/^\d{10}$/.test(String(accountNumber ?? '')) || (mergedCredit.currency && mergedCredit.currency !== 'NGN')) {
    return new Response(JSON.stringify({ success: true, message: 'No account number' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // First check if this virtual account belongs to a contribution group
  const { data: group } = await supabase
    .from('contribution_groups')
    .select('*')
    .eq('account_number', accountNumber)
    .maybeSingle();

  if (group) {
    return await handleGroupAccountCredit(supabase, group, mergedCredit);
  }

  // Otherwise find user profile matching this virtual account number via indexed JSONB lookup (no full table scan)
  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .or('preferences->virtualAccount->>accountNumber.eq.' + accountNumber + ',preferences->virtualAccount->accounts->0->>accountNumber.eq.' + accountNumber)
    .maybeSingle();

  if (!user) {
    return new Response(JSON.stringify({ success: true, message: 'Account not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const reference = String(mergedCredit.payment_reference || mergedCredit.transaction_reference || mergedCredit.reference || mergedCredit.id || "");
  const { data, error } = await supabase.rpc("service_apply_verified_inbound", {
    p_user_id: user.id, p_group_id: null, p_reference: reference, p_provider_id: mergedCredit.id ? String(mergedCredit.id) : null,
    p_amount: Number(mergedCredit.amount), p_currency: mergedCredit.currency || "NGN", p_method: "bank_transfer",
    p_destination: String(accountNumber), p_metadata: {
      senderName: mergedCredit.sender_name, senderBank: mergedCredit.sender_bank,
      senderAccount: maskAccountNumber(mergedCredit.originator_account_number), accountNumber,
      paymentReference: mergedCredit.payment_reference, transactionReference: mergedCredit.transaction_reference,
      narration: mergedCredit.narration,
    },
  });
  if (error || !data) throw error || new Error("Wallet deposit could not be credited.");
  return paymentResponse(data);
}

async function handleContributionWebhook(supabase: any, data: any) {
  const { accountNumber, amount, senderName, bankName, paymentReference } = data;
  const parsedAmount = parseFloat(amount);

  if (!accountNumber || isNaN(parsedAmount) || parsedAmount <= 0) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Valid accountNumber and amount are required'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }

  const { data: contributionGroup, error: findError } = await supabase
    .from('contribution_groups')
    .select('*')
    .eq('account_number', accountNumber)
    .maybeSingle();

  if (findError || !contributionGroup) {
    return new Response(JSON.stringify({
      success: false,
      message: 'No contribution found with this account number',
      accountNumber
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    });
  }

  return await handleGroupAccountCredit(supabase, contributionGroup, {
    account_number: accountNumber,
    amount: parsedAmount,
    sender_name: senderName || 'Anonymous',
    sender_bank: bankName || 'Bank Transfer',
    payment_reference: paymentReference
  });
}
