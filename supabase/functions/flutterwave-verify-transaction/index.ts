import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

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

    const { transaction_id, tx_ref, group_id, anonymous } = await req.json();
    if (!transaction_id) {
      throw new Error('Missing required field: transaction_id');
    }

    // Verify user profile exists and is active
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, email, name, status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (profile.status && profile.status !== 'active') {
      throw new Error(`Your account is currently ${profile.status}.`);
    }

    // Verify transaction server-side with Flutterwave
    const verifyRes = await fetch(
      `${FLUTTERWAVE_BASE_URL}/transactions/${encodeURIComponent(String(transaction_id))}/verify`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      throw new Error(`Flutterwave verify error (${verifyRes.status}): ${errText}`);
    }

    const verifyJson = await verifyRes.json();
    const flwData = verifyJson?.data;

    if (verifyJson?.status !== 'success' || flwData?.status !== 'successful') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Transaction was not successful',
        status: flwData?.status || 'failed',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (tx_ref && flwData.tx_ref && flwData.tx_ref !== tx_ref) {
      throw new Error('Transaction reference mismatch');
    }

    // Ownership check: ensure Flutterwave transaction belongs to this authenticated user
    const flwEmail = String(flwData.customer?.email || '').trim().toLowerCase();
    const userEmails = [user.email, profile.email]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase());
    const metaUserMatch = flwData.meta?.user_id === user.id;
    const txRefUserMatch = String(flwData.tx_ref || '').includes(user.id);

    if (flwEmail && userEmails.length > 0 && !userEmails.includes(flwEmail) && !metaUserMatch && !txRefUserMatch) {
      throw new Error('Transaction does not belong to the authenticated user');
    }

    const referenceId = flwData.flw_ref || flwData.tx_ref || String(transaction_id);
    const amount = Number(flwData.amount || 0);
    if (amount <= 0) {
      throw new Error('Invalid verified transaction amount');
    }

    // Idempotency check so webhook + callback never double-credit
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id, status, contribution_id, amount')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (existingTx && existingTx.status === 'completed') {
      return new Response(JSON.stringify({
        success: true,
        alreadyProcessed: true,
        data: {
          amount: existingTx.amount,
          reference: referenceId,
          contributionId: existingTx.contribution_id,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const targetGroupId = group_id || flwData.meta?.group_id || null;
    const isContribution = !!targetGroupId;

    let balanceBefore = Number(profile.wallet_balance || 0);
    let balanceAfter = balanceBefore;

    if (!isContribution) {
      // Atomic wallet credit
      const { data: creditRes, error: creditErr } = await supabaseAdmin.rpc(
        'service_adjust_wallet_balance',
        { p_user_id: user.id, p_delta: amount }
      );
      if (creditErr || !creditRes?.success) {
        throw new Error(creditRes?.error || 'Failed to credit wallet');
      }
      balanceBefore = Number(creditRes.balance_before);
      balanceAfter = Number(creditRes.balance_after);
    }

    const { data: insertedTx } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        contribution_id: isContribution ? targetGroupId : null,
        type: isContribution ? 'contribution' : 'deposit',
        amount,
        description: isContribution
          ? `Contribution via ${flwData.payment_type || 'card'}`
          : `Wallet top-up via ${flwData.payment_type || 'card'}`,
        status: 'completed',
        payment_method: flwData.payment_type || 'card',
        reference_id: referenceId,
        anonymous: !!anonymous,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        metadata: {
          flutterwaveId: flwData.id,
          flutterwaveRef: flwData.flw_ref,
          txRef: flwData.tx_ref,
          paymentType: flwData.payment_type,
          currency: flwData.currency || 'NGN',
          verifiedViaCallback: true,
        },
      })
      .select('id')
      .maybeSingle();

    // Log external payment track for unified AML oversight (idempotent by reference_id)
    const riskLevel = amount >= 2000000 ? 'critical' : amount >= 500000 ? 'high' : amount >= 250000 ? 'medium' : 'low';
    await supabaseAdmin.from('external_payment_tracks').upsert(
      {
        reference_id: referenceId,
        source_channel: 'card_checkout',
        group_id: isContribution ? targetGroupId : null,
        user_id: user.id,
        transaction_id: insertedTx?.id || null,
        amount,
        sender_name: flwData.customer?.name || profile.name || null,
        sender_bank: flwData.payment_type || 'Flutterwave Card',
        sender_email: flwData.customer?.email || profile.email || null,
        narration: isContribution ? 'Verified group card contribution' : 'Verified wallet card top-up',
        verification_status: 'verified',
        aml_risk_level: riskLevel,
        aml_flags: riskLevel === 'low' ? [] : [`callback_${riskLevel}_value`],
        raw_metadata: { flutterwaveId: flwData.id, txRef: flwData.tx_ref },
      },
      { onConflict: 'reference_id' }
    );

    if (isContribution) {
      const { data: existingContributor } = await supabaseAdmin
        .from('contributors')
        .select('*')
        .eq('group_id', targetGroupId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingContributor) {
        await supabaseAdmin
          .from('contributors')
          .update({
            total_contributed: Number(existingContributor.total_contributed || 0) + amount,
            contribution_count: Number(existingContributor.contribution_count || 0) + 1,
            has_voting_rights: true,
            last_contribution_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContributor.id);
      } else {
        await supabaseAdmin.from('contributors').insert({
          group_id: targetGroupId,
          user_id: user.id,
          amount,
          total_contributed: amount,
          contribution_count: 1,
          has_voting_rights: true,
          join_method: 'card_payment',
          anonymous: !!anonymous,
          joined_at: new Date().toISOString(),
          last_contribution_at: new Date().toISOString(),
        });
      }

      const { data: group } = await supabaseAdmin
        .from('contribution_groups')
        .select('current_amount')
        .eq('id', targetGroupId)
        .single();

      if (group) {
        await supabaseAdmin
          .from('contribution_groups')
          .update({
            current_amount: Number(group.current_amount || 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetGroupId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        amount,
        reference: referenceId,
        contributionId: targetGroupId,
        balanceAfter,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
