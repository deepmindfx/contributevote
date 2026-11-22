import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  FLUTTERWAVE_BASE_URL,
  getFlutterwaveConfig,
  type FlutterwaveRuntimeConfig,
} from "../_shared/flutterwaveConfig.ts";

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

async function fetchTransactionVerifyMeta(
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
    const meta = json?.data?.meta;
    if (meta && typeof meta === 'object') {
      return meta as Record<string, any>;
    }
    return null;
  } catch (err) {
    console.warn('Non-fatal: could not enrich originator details from Flutterwave verify:', err);
    return null;
  }
}

async function trackExternalPaymentAndScreenAml(
  supabase: any,
  params: {
    referenceId: string;
    sourceChannel: 'group_bank_transfer' | 'wallet_bank_transfer' | 'card_checkout' | 'share_link';
    groupId?: string | null;
    userId?: string | null;
    transactionId?: string | null;
    amount: number;
    senderName?: string | null;
    senderBank?: string | null;
    senderAccount?: string | null;
    senderEmail?: string | null;
    destinationAccount?: string | null;
    narration?: string | null;
    requiresVerification?: boolean;
    rawMetadata?: Record<string, any>;
  }
) {
  try {
    const flags: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (params.amount >= 2000000) {
      flags.push('critical_value_gte_2m');
      riskLevel = 'critical';
    } else if (params.amount >= 500000) {
      flags.push('high_value_gte_500k');
      riskLevel = 'high';
    } else if (params.amount >= 250000) {
      flags.push('elevated_external_gte_250k');
      riskLevel = 'medium';
    }

    if (params.requiresVerification) {
      flags.push('unlinked_external_sender');
      if (params.amount >= 250000 && riskLevel === 'medium') riskLevel = 'high';
    }
    if (!params.senderName || params.senderName.toLowerCase() === 'anonymous') {
      flags.push('anonymous_originator');
    }

    const { data: track } = await supabase
      .from('external_payment_tracks')
      .upsert(
        {
          reference_id: params.referenceId,
          source_channel: params.sourceChannel,
          group_id: params.groupId || null,
          user_id: params.userId || null,
          transaction_id: params.transactionId || null,
          amount: params.amount,
          sender_name: params.senderName || null,
          sender_bank: params.senderBank || null,
          sender_account_masked: maskAccountNumber(params.senderAccount),
          sender_email: params.senderEmail || null,
          destination_account: params.destinationAccount || null,
          narration: params.narration || null,
          verification_status: params.requiresVerification ? 'unverified' : 'verified',
          aml_risk_level: riskLevel,
          aml_flags: flags,
          raw_metadata: params.rawMetadata || {},
        },
        { onConflict: 'reference_id' }
      )
      .select('id')
      .maybeSingle();

    // Auto-raise real-time AML alert on high/critical outside payments
    if (riskLevel === 'high' || riskLevel === 'critical') {
      await supabase.from('aml_alerts').upsert(
        {
          alert_key: `ext_webhook:${params.referenceId}`,
          user_id: params.userId || null,
          group_id: params.groupId || null,
          transaction_id: params.transactionId || null,
          alert_type: 'external_payment_risk',
          severity: riskLevel,
          status: 'open',
          risk_score: riskLevel === 'critical' ? 92 : 78,
          amount: params.amount,
          title: `Real-Time External Payment Alert (${params.sourceChannel.replace(/_/g, ' ')})`,
          description: `Outside payment of NGN ${params.amount.toLocaleString()} from ${params.senderName || 'Unidentified sender'} (${params.senderBank || 'External channel'}) flagged automatically.`,
          evidence: {
            reference_id: params.referenceId,
            source_channel: params.sourceChannel,
            sender_name: params.senderName,
            sender_bank: params.senderBank,
            flags,
            track_id: track?.id || null,
          },
        },
        { onConflict: 'alert_key', ignoreDuplicates: true }
      );
    }
  } catch (err) {
    console.error('Non-fatal error logging external payment track:', err);
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
      message: 'Server error processing webhook',
      error: error instanceof Error ? error.message : String(error)
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

  if (event === 'transfer.completed' && data) {
    // Outbound payout callback from flutterwave-transfer (has reference TRF_*)
    if (data.reference && String(data.reference).startsWith('TRF_')) {
      return await handleOutboundTransferCallback(supabase, data);
    }
    // Inbound virtual account credit
    if (data.account_number || data.accountNumber) {
      return await handleVirtualAccountCredit(supabase, data, topLevelMeta);
    }
    return await handleOutboundTransferCallback(supabase, data);
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

async function handleOutboundTransferCallback(supabase: any, transferData: any) {
  const reference = transferData.reference;
  const providerStatus = String(transferData.status || '').toUpperCase();
  if (typeof reference === 'string' && reference.startsWith('TRF_')) {
    const { error } = await supabase.rpc('service_settle_priced_transfer', {
      p_reference: reference, p_status: providerStatus === 'SUCCESSFUL' ? 'completed' : providerStatus === 'FAILED' ? 'failed' : 'pending',
      p_details: { flutterwave_callback_status: providerStatus, complete_message: transferData.complete_message },
    });
    if (error) throw error;
  }
  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleSuccessfulPayment(
  supabase: any,
  paymentData: any,
  topLevelMeta?: Record<string, any> | null,
  flwConfig?: FlutterwaveRuntimeConfig
) {
  const checkoutReference = String(paymentData.tx_ref || '');
  if (checkoutReference.startsWith('CP_CHECKOUT_')) {
    if (paymentData.status !== 'successful') throw new Error('Checkout payment is not confirmed');
    const { data, error } = await supabase.rpc('service_apply_checkout', {
      p_reference: checkoutReference, p_provider_reference: String(paymentData.id || ''),
      p_amount: Number(paymentData.amount), p_currency: paymentData.currency, p_method: paymentData.payment_type,
    });
    if (error || !data) throw error || new Error('Checkout could not be confirmed');
    return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const providerMeta = { ...paymentData.meta, ...paymentData.metadata, ...paymentData.meta_data, ...topLevelMeta };
  if (paymentData.payment_type === 'bank_transfer' && !providerMeta.user_id) {
    const groupId = providerMeta.group_id || (checkoutReference.startsWith('GROUP_') ? checkoutReference.split('_')[1] : null);
    if (groupId) {
      const { data: group } = await supabase.from('contribution_groups').select('id,account_number').eq('id',groupId).maybeSingle();
      if (group) return await handleGroupAccountCredit(supabase, group, {
        ...paymentData, payment_reference: paymentData.flw_ref || paymentData.id,
        sender_name: providerMeta.originatorname || paymentData.customer?.name,
        sender_bank: providerMeta.bankname, originator_account_number: providerMeta.originatoraccountnumber,
      });
    }
  }

  const userEmail = paymentData.customer?.email;
  if (!userEmail) {
    return new Response(JSON.stringify({ success: true, message: 'No email found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', userEmail)
    .maybeSingle();

  if (userError || !user) {
    return new Response(JSON.stringify({ success: true, message: 'User not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const referenceId = paymentData.flw_ref || paymentData.tx_ref;
  const amount = Number(paymentData.amount || 0);

  if (amount <= 0) {
    return new Response(JSON.stringify({ success: true, message: 'Invalid payment amount' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Idempotency check
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id, reference_id, amount, status')
    .eq('reference_id', referenceId)
    .maybeSingle();

  if (existingTx && existingTx.status === 'completed') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Already processed',
      existingTransaction: existingTx
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Merge metadata across all Flutterwave webhook shapes (top-level meta_data, data.meta_data, data.meta)
  let combinedMeta: Record<string, any> = {
    ...(paymentData.meta && typeof paymentData.meta === 'object' ? paymentData.meta : {}),
    ...(paymentData.metadata && typeof paymentData.metadata === 'object' ? paymentData.metadata : {}),
    ...(paymentData.meta_data && typeof paymentData.meta_data === 'object' ? paymentData.meta_data : {}),
    ...(topLevelMeta && typeof topLevelMeta === 'object' ? topLevelMeta : {}),
  };

  let originatorName = cleanSenderName(
    combinedMeta.originatorname ||
      combinedMeta.originator_name ||
      combinedMeta.sender_name ||
      combinedMeta.senderName
  );
  let originatorBank = cleanString(
    combinedMeta.bankname ||
      combinedMeta.bank_name ||
      combinedMeta.sender_bank ||
      combinedMeta.senderBank
  );
  let originatorAccount = cleanString(
    combinedMeta.originatoraccountnumber ||
      combinedMeta.originator_account_number ||
      combinedMeta.sender_account ||
      combinedMeta.originatorAccountNumber
  );
  let virtualAccountNumber = cleanString(
    combinedMeta.virtualaccountnumber || combinedMeta.virtual_account_number
  );

  // Flutterwave v3 bank_transfer webhooks sometimes omit originator fields in data.*
  // Enrich directly from Flutterwave's /transactions/{id}/verify endpoint when missing.
  if (
    paymentData.payment_type === 'bank_transfer' &&
    (!originatorName || !originatorBank) &&
    paymentData.id
  ) {
    const verifyMeta = await fetchTransactionVerifyMeta(paymentData.id, flwConfig);
    if (verifyMeta) {
      combinedMeta = { ...combinedMeta, ...verifyMeta };
      originatorName =
        originatorName ||
        cleanSenderName(
          verifyMeta.originatorname ||
            verifyMeta.originator_name ||
            verifyMeta.sender_name ||
            verifyMeta.senderName
        );
      originatorBank =
        originatorBank ||
        cleanString(
          verifyMeta.bankname ||
            verifyMeta.bank_name ||
            verifyMeta.sender_bank ||
            verifyMeta.senderBank
        );
      originatorAccount =
        originatorAccount ||
        cleanString(
          verifyMeta.originatoraccountnumber ||
            verifyMeta.originator_account_number ||
            verifyMeta.sender_account
        );
      virtualAccountNumber =
        virtualAccountNumber ||
        cleanString(verifyMeta.virtualaccountnumber || verifyMeta.virtual_account_number);
    }
  }

  const cleanCustomerName = cleanSenderName(paymentData.customer?.name);
  const resolvedSenderName = originatorName || cleanCustomerName || null;
  const resolvedSenderBank = originatorBank || null;
  const maskedSenderAccount = maskAccountNumber(originatorAccount);

  // Determine if this payment targets a specific group
  let groupId = combinedMeta.group_id || paymentData.meta?.group_id || paymentData.metadata?.group_id || null;
  const txRef = paymentData.tx_ref;

  if (!groupId && txRef && String(txRef).startsWith('GROUP_')) {
    const parts = String(txRef).split('_');
    if (parts.length >= 2) {
      const extractedId = parts[1];
      const { data: group } = await supabase
        .from('contribution_groups')
        .select('id')
        .eq('id', extractedId)
        .maybeSingle();

      if (group) {
        groupId = group.id;
      }
    }
  }

  const isContribution = !!groupId;
  const isVerifiedLegacyCheckout = isContribution && combinedMeta.user_id === user.id && combinedMeta.group_id === groupId;
  if (isContribution && !isVerifiedLegacyCheckout) {
    return await handleGroupAccountCredit(supabase, { id: groupId }, {
      amount, payment_reference: referenceId, sender_name: resolvedSenderName, sender_bank: resolvedSenderBank,
      originator_account_number: originatorAccount, account_number: virtualAccountNumber,
    });
  }
  const balanceBefore = Number(user.wallet_balance || 0);
  const balanceAfter = isContribution ? balanceBefore : balanceBefore + amount;
  const senderDescriptor = resolvedSenderName
    ? `${resolvedSenderName}${resolvedSenderBank ? ` (${resolvedSenderBank})` : ''}`
    : null;
  const prettyChannel = String(paymentData.payment_type || 'card').replace(/_/g, ' ');

  const transactionData = {
    user_id: user.id,
    contribution_id: isContribution ? groupId : null,
    type: isContribution ? 'contribution' : 'deposit',
    amount,
    description: isContribution
      ? senderDescriptor
        ? `Contribution from ${senderDescriptor}`
        : `Contribution to group via ${prettyChannel}`
      : senderDescriptor
        ? `Bank transfer from ${senderDescriptor}`
        : `Wallet top-up via ${prettyChannel}`,
    reference_id: referenceId,
    payment_method: paymentData.payment_type || 'card',
    status: 'completed',
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    metadata: {
      flutterwaveId: paymentData.id,
      flutterwaveRef: paymentData.flw_ref,
      txRef: paymentData.tx_ref,
      paymentType: paymentData.payment_type,
      currency: paymentData.currency || 'NGN',
      customerEmail: paymentData.customer?.email,
      ...(resolvedSenderName ? { customerName: resolvedSenderName, senderName: resolvedSenderName } : {}),
      ...(originatorName ? { originatorName } : {}),
      ...(resolvedSenderBank ? { bankName: resolvedSenderBank, senderBank: resolvedSenderBank } : {}),
      ...(maskedSenderAccount
        ? { senderAccount: maskedSenderAccount, originatorAccountNumber: maskedSenderAccount }
        : {}),
      ...(virtualAccountNumber ? { virtualAccountNumber } : {}),
      isContribution,
      groupId,
      votingRightsGranted: isContribution
    }
  };

  let insertedTxId: string | null = existingTx?.id || null;
  if (existingTx) {
    const { error: updateTxErr } = await supabase
      .from('transactions')
      .update(transactionData)
      .eq('id', existingTx.id);
    if (updateTxErr) throw updateTxErr;
  } else {
    const { data: createdTx, error: txError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select('id')
      .single();
    if (txError) throw txError;
    insertedTxId = createdTx?.id || null;
  }

  await trackExternalPaymentAndScreenAml(supabase, {
    referenceId,
    sourceChannel: isContribution ? 'card_checkout' : 'wallet_bank_transfer',
    groupId: isContribution ? groupId : null,
    userId: user.id,
    transactionId: insertedTxId,
    amount,
    senderName: resolvedSenderName || user.name || null,
    senderBank: resolvedSenderBank || paymentData.payment_type || 'Flutterwave',
    senderAccount: originatorAccount || null,
    senderEmail: paymentData.customer?.email || user.email,
    destinationAccount: virtualAccountNumber || null,
    narration: transactionData.description,
    requiresVerification: false,
    rawMetadata: transactionData.metadata,
  });

  if (isContribution) {
    await addContributorWithVotingRights(supabase, groupId, user.id, amount);
  } else {
    const { data: creditRes, error: balanceError } = await supabase.rpc(
      'service_adjust_wallet_balance',
      { p_user_id: user.id, p_delta: amount }
    );

    if (balanceError || !creditRes?.success) {
      throw balanceError || new Error(creditRes?.error || 'Failed to credit wallet');
    }

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'wallet_deposit',
      title: 'Wallet Funded',
      message: senderDescriptor
        ? `₦${amount.toLocaleString()} received from ${senderDescriptor} and credited to your wallet.`
        : `₦${amount.toLocaleString()} has been credited to your wallet.`,
      is_read: false
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: isContribution ? 'Contribution processed' : 'Payment processed successfully',
    data: { userId: user.id, amount, isContribution, senderName: resolvedSenderName, senderBank: resolvedSenderBank }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function addContributorWithVotingRights(supabase: any, groupId: string, userId: string, amount: number) {
  const { data: existing } = await supabase
    .from('contributors')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('contributors')
      .update({
        total_contributed: Number(existing.total_contributed || 0) + amount,
        contribution_count: Number(existing.contribution_count || 0) + 1,
        last_contribution_at: new Date().toISOString(),
        has_voting_rights: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('contributors')
      .insert({
        group_id: groupId,
        user_id: userId,
        amount,
        total_contributed: amount,
        contribution_count: 1,
        has_voting_rights: true,
        join_method: 'card_payment',
        joined_at: new Date().toISOString(),
        last_contribution_at: new Date().toISOString()
      });
  }

  const { data: group } = await supabase
    .from('contribution_groups')
    .select('current_amount')
    .eq('id', groupId)
    .single();

  if (group) {
    await supabase
      .from('contribution_groups')
      .update({
        current_amount: Number(group.current_amount || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId);
  }
}

async function recordBankTransferContribution(
  supabase: any,
  groupId: string,
  amount: number,
  senderInfo: any,
  updateGroupTotal: boolean = true
) {
  await supabase
    .from('contributors')
    .insert({
      group_id: groupId,
      user_id: null,
      amount,
      total_contributed: amount,
      contribution_count: 1,
      has_voting_rights: false,
      join_method: 'bank_transfer',
      anonymous: true,
      joined_at: new Date().toISOString(),
      last_contribution_at: new Date().toISOString(),
      metadata: {
        senderName: senderInfo.senderName,
        senderBank: senderInfo.senderBank,
        accountNumber: senderInfo.accountNumber,
        note: 'Bank transfer - requires manual verification for voting rights'
      }
    });

  if (updateGroupTotal) {
    const { data: group } = await supabase
      .from('contribution_groups')
      .select('current_amount')
      .eq('id', groupId)
      .single();

    if (group) {
      await supabase
        .from('contribution_groups')
        .update({
          current_amount: Number(group.current_amount || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);
    }
  }
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
  if (!accountNumber) {
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
    .filter('preferences->virtualAccount->>accountNumber', 'eq', String(accountNumber))
    .maybeSingle();

  if (!user) {
    return new Response(JSON.stringify({ success: true, message: 'Account not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const amount = Number(mergedCredit.amount || 0);
  if (amount <= 0) {
    return new Response(JSON.stringify({ success: true, message: 'Invalid credit amount' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const referenceId =
    mergedCredit.payment_reference ||
    mergedCredit.transaction_reference ||
    mergedCredit.reference ||
    `BANK_${amount}_${Date.now()}`;

  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id, reference_id, amount')
    .eq('reference_id', referenceId)
    .maybeSingle();

  if (existingTx) {
    return new Response(JSON.stringify({
      success: true,
      message: 'Already processed',
      existingTransaction: existingTx
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const groupId = mergedCredit.meta?.group_id || mergedCredit.metadata?.group_id || null;
  if (groupId) return await handleGroupAccountCredit(supabase, { id: groupId }, mergedCredit);
  const isContribution = !!groupId;
  const balanceBefore = Number(user.wallet_balance || 0);
  const balanceAfter = isContribution ? balanceBefore : balanceBefore + amount;
  const maskedSenderAccount = maskAccountNumber(mergedCredit.originator_account_number);
  const senderDescriptor = mergedCredit.sender_name
    ? `${mergedCredit.sender_name}${mergedCredit.sender_bank ? ` (${mergedCredit.sender_bank})` : ''}`
    : null;

  const { data: vaTx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      contribution_id: isContribution ? groupId : null,
      type: isContribution ? 'contribution' : 'deposit',
      amount,
      description: isContribution
        ? `Bank transfer contribution from ${senderDescriptor || 'Bank'}`
        : `Bank transfer from ${senderDescriptor || 'Bank'}`,
      reference_id: referenceId,
      payment_method: 'bank_transfer',
      status: 'completed',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      metadata: {
        ...(mergedCredit.sender_name
          ? { senderName: mergedCredit.sender_name, originatorName: mergedCredit.sender_name }
          : {}),
        ...(mergedCredit.sender_bank
          ? { senderBank: mergedCredit.sender_bank, bankName: mergedCredit.sender_bank }
          : {}),
        ...(maskedSenderAccount
          ? { senderAccount: maskedSenderAccount, originatorAccountNumber: maskedSenderAccount }
          : {}),
        narration: mergedCredit.narration,
        paymentReference: mergedCredit.payment_reference,
        transactionReference: mergedCredit.transaction_reference,
        accountNumber,
        isContribution,
        groupId,
        votingRightsGranted: false,
        requiresVerification: isContribution
      }
    })
    .select('id')
    .single();

  if (txError) throw txError;

  await trackExternalPaymentAndScreenAml(supabase, {
    referenceId,
    sourceChannel: isContribution ? 'group_bank_transfer' : 'wallet_bank_transfer',
    groupId: isContribution ? groupId : null,
    userId: user.id,
    transactionId: vaTx?.id || null,
    amount,
    senderName: mergedCredit.sender_name || 'External Sender',
    senderBank: mergedCredit.sender_bank || 'External Bank',
    senderAccount: mergedCredit.originator_account_number || null,
    senderEmail: user.email,
    destinationAccount: accountNumber,
    narration: mergedCredit.narration || `Virtual account credit`,
    requiresVerification: isContribution,
    rawMetadata: mergedCredit,
  });

  if (isContribution) {
    await recordBankTransferContribution(supabase, groupId, amount, {
      senderName: mergedCredit.sender_name,
      senderBank: mergedCredit.sender_bank,
      accountNumber
    });
  } else {
    const { data: creditRes, error: balanceError } = await supabase.rpc(
      'service_adjust_wallet_balance',
      { p_user_id: user.id, p_delta: amount }
    );

    if (balanceError || !creditRes?.success) {
      throw balanceError || new Error(creditRes?.error || 'Failed to credit wallet');
    }

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'wallet_deposit',
      title: 'Wallet Credited',
      message: senderDescriptor
        ? `₦${amount.toLocaleString()} received from ${senderDescriptor} via bank transfer.`
        : `₦${amount.toLocaleString()} received via bank transfer.`,
      is_read: false
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: isContribution
      ? 'Bank transfer contribution recorded (requires admin verification for voting rights)'
      : 'Virtual account credit processed successfully',
    data: {
      userId: user.id,
      amount,
      isContribution,
      votingRights: false,
      requiresVerification: isContribution
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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
