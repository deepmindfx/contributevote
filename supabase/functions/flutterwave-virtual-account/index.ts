import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { flutterwaveFetch, getFlutterwaveConfig } from "../_shared/flutterwaveConfig.ts";
import { beginBonusVerification, verifyBonusBvn } from "./bonusVerification.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function isAccountNumber(value: unknown) {
  return typeof value === 'string' && /^\d{10}$/.test(value);
}

function readOrderReference(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z0-9_-]{3,120}$/i.test(value) ? value : undefined;
}

function readProviderAccount(data: Record<string, unknown> | undefined) {
  const account_number = String(data?.account_number ?? '');
  const bank_name = typeof data?.bank_name === 'string' ? data.bank_name.trim() : '';
  const flw_ref = typeof data?.flw_ref === 'string' ? data.flw_ref.trim() : undefined;
  const order_ref = readOrderReference(data?.order_ref);
  const status = String(data?.account_status ?? '').trim().toLowerCase();
  if (!isAccountNumber(account_number) || !bank_name || (!flw_ref && !order_ref) || (status && status !== 'active')) return null;
  return { account_number, bank_name, flw_ref, order_ref, account_reference: data?.account_reference };
}

function groupBankPending(orderReferenceKnown = false) {
  return json({ success: false, code: orderReferenceKnown ? 'GROUP_BANK_PENDING' : 'GROUP_BANK_REVIEW_REQUIRED',
    error: orderReferenceKnown ? 'The bank is still confirming your account. Check again shortly.'
      : 'The original bank request is awaiting confirmation. If this continues, contact support from the saved group.' }, 409);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Sign in to set up a bank account.' }, 401);
    }

    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user?.email || !user.email_confirmed_at) {
      return json({ success: false, error: 'Sign in with a confirmed email to set up a bank account.' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('status, name, bvn, preferences')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || (profile.status ?? 'active') !== 'active') {
      return json({ success: false, error: 'Your profile could not be used to set up a bank account.' }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ success: false, error: 'Enter a valid 11-digit BVN.' }, 400);
    // Older group clients identify their request by the GROUP_ reference.
    const legacyReference = typeof body.tx_ref === 'string' ? body.tx_ref : '';
    const forGroup = body.purpose === 'group' || legacyReference.startsWith('GROUP_');
    const name = profile.name || 'CollectiPay';
    let narration = `Virtual account for ${name}`;
    let txRef = `COLL_${user.id}_${crypto.randomUUID()}`;
    let groupTarget: string | undefined;

    const existing = profile.preferences?.virtualAccount;
    const primary = isAccountNumber(existing?.accountNumber) ? existing : existing?.accounts?.[0];
    if (forGroup) {
      const groupId = body.groupId ?? legacyReference.split('_')[1];
      if (typeof groupId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(groupId)) {
        return json({ success: false, error: 'Select a valid group.' }, 400);
      }
      const { data: group } = await supabaseAdmin.from('contribution_groups')
        .select('name, status, archived, account_number, bank_name, account_reference').eq('id', groupId).eq('creator_id', user.id).maybeSingle();
      if (!group || group.archived || (group.status ?? 'active') !== 'active') {
        return json({ success: false, error: 'Only the owner of an active group can create its bank account.' }, 403);
      }
      if (isAccountNumber(group.account_number)) return json({ success: true, data: {
        account_number: group.account_number, bank_name: group.bank_name, order_ref: group.account_reference,
      } });
      groupTarget = groupId;
      txRef = `GROUP_${groupId}_VA`;
      narration = `Virtual account for ${group.name}`;
    } else if (isAccountNumber(primary?.accountNumber)) {
      return json({ success: true, account: existing, bonusAmount: 0, data: {
        account_number: primary.accountNumber, bank_name: primary.bankName,
        flw_ref: existing.flwRef, order_ref: existing.orderRef, account_reference: existing.accountReference,
      } });
    }

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.secretKey) return json({ success: false, error: 'Bank account setup is temporarily unavailable.' }, 503);

    let bvn = (forGroup ? String(profile.bvn || '') : typeof body.bvn === 'string' ? body.bvn : '').trim();
    let verificationId: string | undefined;
    const resuming = !forGroup && typeof body.verificationId === 'string';
    if (!resuming && !/^\d{11}$/.test(bvn)) {
      return json({ success: false, error: forGroup ? 'Save your BVN before setting up the group account.' : 'Enter a valid 11-digit BVN.' }, 400);
    }
    if (resuming) {
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.verificationId)) {
        return json({ success: false, error: 'Start BVN verification again.' }, 400);
      }
      verificationId = body.verificationId;
    } else if (!forGroup && body.claimBonus === true) {
      const verified = await beginBonusVerification(supabaseAdmin, config, user.id, name, bvn);
      if (verified.error) return json({ success: false, error: verified.error }, 422);
      if (verified.verificationUrl) return json({ success: true, verificationUrl: verified.verificationUrl });
      verificationId = verified.id;
    }
    if (verificationId) {
      const verified = await verifyBonusBvn(supabaseAdmin, config, user.id, user.email, verificationId);
      if (!verified.bvn) return json({ success: false, error: verified.error }, 422);
      bvn = verified.bvn;
    }

    const linkGroupAccount = async (groupId: string, account: Record<string, unknown>) => {
      const { data, error } = await supabaseAdmin.rpc('service_save_group_bank_account', {
        p_user_id: user.id, p_group_id: groupId, p_account: account,
      });
      if (error || !data) return json({ success: false, error: 'Couldn’t link the confirmed group bank account. Retry setup.' }, 503);
      return json({ success: true, data });
    };
    const rememberProviderAccount = async (groupId: string, account: Record<string, unknown>, attemptId?: string) => {
      let update = supabaseAdmin.from('group_bank_account_setups').update({ provider_account: account }).eq('group_id', groupId);
      if (attemptId) update = update.eq('attempt_id', attemptId);
      const { error } = await update;
      if (error) console.error('Could not retain group account for recovery', { code: error.code });
    };
    let groupAttempt: string | undefined;
    if (groupTarget) {
      const { data: setup, error } = await supabaseAdmin.rpc('service_claim_group_bank_setup', {
        p_user_id: user.id, p_group_id: groupTarget,
      });
      if (error || !setup) return json({ success: false, error: 'Couldn’t start group bank setup. Try again.' }, 503);
      if (setup.account) return json({ success: true, data: setup.account });
      if (!setup.attempt_id) {
        const knownAccount = readProviderAccount(setup.provider_account);
        if (knownAccount) return linkGroupAccount(groupTarget, knownAccount);
        const orderRef = readOrderReference(setup.provider_account?.order_ref);
        if (!orderRef) return groupBankPending();
        try {
          const { response } = await flutterwaveFetch(`/virtual-account-numbers/${encodeURIComponent(orderRef)}`,
            { signal: AbortSignal.timeout(15_000) }, config);
          const result = await response.json().catch(() => null);
          const account = readProviderAccount(result?.data);
          if (!response.ok || result?.status !== 'success' || !account || account.order_ref !== orderRef) return groupBankPending(true);
          await rememberProviderAccount(groupTarget, account);
          return linkGroupAccount(groupTarget, account);
        } catch {
          return groupBankPending(true);
        }
      }
      groupAttempt = setup.attempt_id;
    } else {
      const { data: claimed } = await supabaseAdmin.rpc('service_claim_wallet_account_setup', { p_user_id: user.id });
      if (!claimed) return json({ success: false, error: 'Bank setup is in progress. Check again in a moment.' }, 409);
      const { data: saved, error: saveError } = await supabaseUserClient.rpc('save_user_bvn', { p_bvn: bvn });
      if (saveError || !saved?.success) {
        return json({ success: false, error: saved?.error || 'Couldn’t save your BVN. Please try again.' }, 400);
      }
    }

    const providerRequest = flutterwaveFetch('/virtual-account-numbers', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      body: { email: user.email, tx_ref: txRef, bvn, narration, is_permanent: true, currency: 'NGN' },
    }, config);
    const providerResult = await providerRequest.catch((error) => {
      if (groupTarget) return null;
      throw error;
    });
    if (!providerResult) return groupBankPending();
    const { response } = providerResult;
    const result = await response.json().catch(() => null);
    const data = result?.data;
    const providerAccount = readProviderAccount(data);
    if (!response.ok || result?.status !== 'success' || !providerAccount) {
      console.warn('Flutterwave did not confirm a usable virtual account', { status: response.status });
      if (groupTarget && groupAttempt) {
        const orderRef = readOrderReference(data?.order_ref);
        if (response.ok && result?.status === 'success' && orderRef) {
          await rememberProviderAccount(groupTarget, { order_ref: orderRef }, groupAttempt);
          return groupBankPending(true);
        }
        const rejected = [400, 401, 403, 422].includes(response.status) && result?.status === 'error'
          && !orderRef && !/duplicate|already|exists|unique|conflict/i.test(String(result.message || ''));
        if (!rejected) return groupBankPending();
        await supabaseAdmin.from('group_bank_account_setups').delete().eq('group_id', groupTarget).eq('attempt_id', groupAttempt);
      }
      return json({ success: false, error: 'The bank couldn’t confirm your account. Check your BVN and try again.' }, 422);
    }

    if (groupTarget && groupAttempt) {
      await rememberProviderAccount(groupTarget, providerAccount, groupAttempt);
      return linkGroupAccount(groupTarget, providerAccount);
    }

    const { data: completed, error: completeError } = await supabaseAdmin.rpc('service_complete_wallet_bank_account', {
      p_user_id: user.id,
      p_bvn: bvn,
      p_live: config.mode === 'live' && !config.secretKey.startsWith('FLWSECK_TEST'),
      p_verification_id: verificationId ?? null,
      p_account: {
        accountNumber: providerAccount.account_number, bankName: providerAccount.bank_name, accountName: name,
        flwRef: providerAccount.flw_ref, orderRef: providerAccount.order_ref,
        accountReference: providerAccount.account_reference, createdAt: new Date().toISOString(),
      },
    });
    if (completeError || !completed?.account) {
      console.error('Could not persist confirmed virtual account', { code: completeError?.code });
      return json({ success: false, error: 'Couldn’t finish setting up your bank account. Please try again.' }, 503);
    }
    const account = completed.account;
    return json({ success: true, ...completed, data: {
      account_number: account.accountNumber, bank_name: account.bankName,
      flw_ref: account.flwRef, order_ref: account.orderRef, account_reference: account.accountReference,
    } });
  } catch {
    console.error('Virtual account setup failed unexpectedly');
    return json({ success: false, error: 'Bank account setup is temporarily unavailable.' }, 503);
  }
});
