import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash'
};

function maskAccountNumber(acc?: string | null): string | null {
  if (!acc) return null;
  const clean = String(acc).trim();
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
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
    // Strictly verify Flutterwave webhook signature whenever configured
    const signature = req.headers.get('verif-hash');
    const expectedHash =
      Deno.env.get('FLW_SECRET_HASH') ||
      Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');

    if (expectedHash && (!signature || signature !== expectedHash)) {
      console.error('Invalid or missing webhook signature');
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid signature'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    console.log('Received webhook event:', webhookData.event || webhookData.type);

    if (webhookData.event) {
      return await handleFlutterwaveWebhook(supabase, webhookData);
    }

    const { type, data } = webhookData;
    if (type === 'contribution_received' && data) {
      return await handleContributionWebhook(supabase, data);
    }

    if (type === 'virtual_account_credit' && data) {
      return await handleVirtualAccountCredit(supabase, data);
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

async function handleFlutterwaveWebhook(supabase: any, webhookData: any) {
  const { event, data } = webhookData;

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
    return await handleSuccessfulPayment(supabase, data);
  }

  if (event === 'transfer.completed' && data) {
    // Outbound payout callback from flutterwave-transfer (has reference TRF_*)
    if (data.reference && String(data.reference).startsWith('TRF_')) {
      return await handleOutboundTransferCallback(supabase, data);
    }
    // Inbound virtual account credit
    if (data.account_number || data.accountNumber) {
      return await handleVirtualAccountCredit(supabase, data);
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
  const flwStatus = String(transferData.status || '').toUpperCase();

  if (reference) {
    const newStatus =
      flwStatus === 'SUCCESSFUL' ? 'completed' :
      flwStatus === 'FAILED' ? 'failed' :
      'pending';

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, metadata')
      .eq('reference_id', reference)
      .maybeSingle();

    if (existingTx) {
      await supabase
        .from('transactions')
        .update({
          status: newStatus,
          metadata: {
            ...(existingTx.metadata || {}),
            flutterwave_callback_status: flwStatus,
            complete_message: transferData.complete_message
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTx.id);

      // Refund wallet automatically if an outbound transfer transitions from pending -> failed
      if (newStatus === 'failed' && existingTx.status !== 'failed' && existingTx.user_id) {
        const fee = Number(existingTx.metadata?.fee || 0);
        const refundTotal = Number(existingTx.amount || 0) + fee;
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', existingTx.user_id)
          .single();

        if (profile && refundTotal > 0) {
          const newBalance = Number(profile.wallet_balance || 0) + refundTotal;
          await supabase
            .from('profiles')
            .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', existingTx.user_id);

          await supabase.from('notifications').insert({
            user_id: existingTx.user_id,
            type: 'transfer_failed',
            title: 'Transfer Failed & Refunded',
            message: `Your transfer of ₦${Number(existingTx.amount).toLocaleString()} failed and ₦${refundTotal.toLocaleString()} was refunded to your wallet.`,
            is_read: false
          });
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, message: 'Transfer status updated' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleSuccessfulPayment(supabase: any, paymentData: any) {
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

  // Determine if this payment targets a specific group
  let groupId = paymentData.meta?.group_id || paymentData.metadata?.group_id || null;
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
  const balanceBefore = Number(user.wallet_balance || 0);
  const balanceAfter = isContribution ? balanceBefore : balanceBefore + amount;

  const transactionData = {
    user_id: user.id,
    contribution_id: isContribution ? groupId : null,
    type: isContribution ? 'contribution' : 'deposit',
    amount,
    description: isContribution
      ? `Contribution to group via ${paymentData.payment_type || 'card'}`
      : `Wallet top-up via ${paymentData.payment_type || 'card'}`,
    reference_id: referenceId,
    payment_method: paymentData.payment_type || 'card',
    status: 'completed',
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    metadata: {
      flutterwaveRef: paymentData.flw_ref,
      txRef: paymentData.tx_ref,
      paymentType: paymentData.payment_type,
      currency: paymentData.currency || 'NGN',
      customerEmail: paymentData.customer?.email,
      customerName: paymentData.customer?.name,
      originatorName: paymentData.meta_data?.originatorname,
      bankName: paymentData.meta_data?.bankname,
      isContribution,
      groupId,
      votingRightsGranted: isContribution && paymentData.payment_type !== 'bank_transfer'
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
    senderName: paymentData.meta_data?.originatorname || paymentData.customer?.name || user.name,
    senderBank: paymentData.meta_data?.bankname || paymentData.payment_type || 'Flutterwave',
    senderAccount: paymentData.meta_data?.originatoraccountnumber || null,
    senderEmail: paymentData.customer?.email || user.email,
    narration: transactionData.description,
    requiresVerification: isContribution && paymentData.payment_type === 'bank_transfer',
    rawMetadata: transactionData.metadata,
  });

  if (isContribution) {
    if (paymentData.payment_type === 'bank_transfer') {
      await recordBankTransferContribution(supabase, groupId, amount, {
        senderName: paymentData.meta_data?.originatorname || 'Anonymous',
        senderBank: paymentData.meta_data?.bankname || 'Bank',
        accountNumber: paymentData.meta_data?.originatoraccountnumber || 'Unknown'
      });
    } else {
      await addContributorWithVotingRights(supabase, groupId, user.id, amount);
    }
  } else {
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ wallet_balance: balanceAfter, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (balanceError) throw balanceError;

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'wallet_deposit',
      title: 'Wallet Funded',
      message: `₦${amount.toLocaleString()} has been credited to your wallet.`,
      is_read: false
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: isContribution ? 'Contribution processed' : 'Payment processed successfully',
    data: { userId: user.id, amount, isContribution }
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
  const amount = Number(creditData.amount || 0);
  if (amount <= 0) {
    return new Response(JSON.stringify({ success: true, message: 'Invalid credit amount' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const referenceId =
    creditData.payment_reference ||
    creditData.transaction_reference ||
    creditData.reference ||
    `GROUP_BANK_${amount}_${Date.now()}`;

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

  const { data: groupTx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: group.creator_id,
      contribution_id: group.id,
      type: 'contribution',
      amount,
      description: `Bank transfer to ${group.name} from ${creditData.sender_name || creditData.senderName || 'Bank'}`,
      reference_id: referenceId,
      payment_method: 'bank_transfer',
      status: 'completed',
      metadata: {
        senderName: creditData.sender_name || creditData.senderName,
        senderBank: creditData.sender_bank || creditData.bankName,
        narration: creditData.narration,
        paymentReference: creditData.payment_reference,
        transactionReference: creditData.transaction_reference,
        accountNumber: creditData.account_number || creditData.accountNumber,
        isGroupContribution: true,
        groupId: group.id,
        groupName: group.name,
        votingRightsGranted: false,
        requiresVerification: true
      }
    })
    .select('id')
    .single();

  if (txError) throw txError;

  await trackExternalPaymentAndScreenAml(supabase, {
    referenceId,
    sourceChannel: 'group_bank_transfer',
    groupId: group.id,
    userId: group.creator_id,
    transactionId: groupTx?.id || null,
    amount,
    senderName: creditData.sender_name || creditData.senderName || 'External Sender',
    senderBank: creditData.sender_bank || creditData.bankName || 'External Bank',
    senderAccount: creditData.originator_account_number || creditData.sender_account || null,
    destinationAccount: creditData.account_number || creditData.accountNumber || group.account_number,
    narration: creditData.narration || `Transfer to ${group.name}`,
    requiresVerification: true,
    rawMetadata: creditData,
  });

  // Record bank transfer contributor WITHOUT double-incrementing group balance
  await recordBankTransferContribution(
    supabase,
    group.id,
    amount,
    {
      senderName: creditData.sender_name || creditData.senderName,
      senderBank: creditData.sender_bank || creditData.bankName,
      accountNumber: creditData.account_number || creditData.accountNumber
    },
    false
  );

  // Increment group current_amount exactly once
  const newGroupAmount = Number(group.current_amount || 0) + amount;
  const { error: groupBalanceError } = await supabase
    .from('contribution_groups')
    .update({
      current_amount: newGroupAmount,
      updated_at: new Date().toISOString()
    })
    .eq('id', group.id);

  if (groupBalanceError) throw groupBalanceError;

  if (group.creator_id) {
    await supabase.from('notifications').insert({
      user_id: group.creator_id,
      type: 'bank_transfer_received',
      title: 'Bank Transfer Received',
      message: `₦${amount.toLocaleString()} transferred to ${group.name}. Verify the sender in Admin Panel to grant voting rights.`,
      related_id: group.id,
      is_read: false
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Bank transfer to group "${group.name}" recorded successfully`,
    data: {
      groupId: group.id,
      groupName: group.name,
      amount,
      newGroupBalance: newGroupAmount,
      votingRights: false,
      requiresVerification: true
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleVirtualAccountCredit(supabase: any, creditData: any) {
  const accountNumber = creditData.account_number || creditData.accountNumber;
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
    return await handleGroupAccountCredit(supabase, group, creditData);
  }

  // Otherwise find user profile matching this virtual account number
  const { data: users } = await supabase
    .from('profiles')
    .select('*');

  const user = users?.find((u: any) =>
    u.preferences?.virtualAccount?.accountNumber === accountNumber
  );

  if (!user) {
    return new Response(JSON.stringify({ success: true, message: 'Account not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const amount = Number(creditData.amount || 0);
  if (amount <= 0) {
    return new Response(JSON.stringify({ success: true, message: 'Invalid credit amount' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const referenceId =
    creditData.payment_reference ||
    creditData.transaction_reference ||
    creditData.reference ||
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

  const groupId = creditData.meta?.group_id || creditData.metadata?.group_id || null;
  const isContribution = !!groupId;
  const balanceBefore = Number(user.wallet_balance || 0);
  const balanceAfter = isContribution ? balanceBefore : balanceBefore + amount;

  const { data: vaTx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      contribution_id: isContribution ? groupId : null,
      type: isContribution ? 'contribution' : 'deposit',
      amount,
      description: isContribution
        ? `Bank transfer contribution from ${creditData.sender_name || creditData.senderName || 'Bank'}`
        : `Bank transfer from ${creditData.sender_name || creditData.senderName || 'Bank'}`,
      reference_id: referenceId,
      payment_method: 'bank_transfer',
      status: 'completed',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      metadata: {
        senderName: creditData.sender_name || creditData.senderName,
        senderBank: creditData.sender_bank || creditData.bankName,
        narration: creditData.narration,
        paymentReference: creditData.payment_reference,
        transactionReference: creditData.transaction_reference,
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
    senderName: creditData.sender_name || creditData.senderName || 'External Sender',
    senderBank: creditData.sender_bank || creditData.bankName || 'External Bank',
    senderAccount: creditData.originator_account_number || creditData.sender_account || null,
    senderEmail: user.email,
    destinationAccount: accountNumber,
    narration: creditData.narration || `Virtual account credit`,
    requiresVerification: isContribution,
    rawMetadata: creditData,
  });

  if (isContribution) {
    await recordBankTransferContribution(supabase, groupId, amount, {
      senderName: creditData.sender_name || creditData.senderName,
      senderBank: creditData.sender_bank || creditData.bankName,
      accountNumber
    });
  } else {
    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ wallet_balance: balanceAfter, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (balanceError) throw balanceError;

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'wallet_deposit',
      title: 'Wallet Credited',
      message: `₦${amount.toLocaleString()} received via bank transfer.`,
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
