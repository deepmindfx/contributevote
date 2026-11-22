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
      .select('status, name, preferences')
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
      if (typeof groupId !== 'string' || !/^[\da-f-]{36}$/i.test(groupId)) {
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
      txRef = `GROUP_${groupId}_${crypto.randomUUID()}`;
      narration = `Virtual account for ${group.name}`;
    } else if (isAccountNumber(primary?.accountNumber)) {
      return json({ success: true, account: existing, bonusAmount: 0, data: {
        account_number: primary.accountNumber, bank_name: primary.bankName,
        flw_ref: existing.flwRef, order_ref: existing.orderRef, account_reference: existing.accountReference,
      } });
    }

    const config = await getFlutterwaveConfig({ supabaseAdmin });
    if (!config.secretKey) return json({ success: false, error: 'Bank account setup is temporarily unavailable.' }, 503);

    let bvn = typeof body.bvn === 'string' ? body.bvn.trim() : '';
    let verificationId: string | undefined;
    const resuming = !forGroup && typeof body.verificationId === 'string';
    if (!resuming && !/^\d{11}$/.test(bvn)) {
      return json({ success: false, error: 'Enter a valid 11-digit BVN.' }, 400);
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

    if (!forGroup) {
      const { data: claimed } = await supabaseAdmin.rpc('service_claim_wallet_account_setup', { p_user_id: user.id });
      if (!claimed) return json({ success: false, error: 'Bank setup is in progress. Check again in a moment.' }, 409);
    }
    const { data: saved, error: saveError } = await supabaseUserClient.rpc('save_user_bvn', { p_bvn: bvn });
    if (saveError || !saved?.success) {
      return json({ success: false, error: saved?.error || 'Couldn’t save your BVN. Please try again.' }, 400);
    }

    const { response } = await flutterwaveFetch('/virtual-account-numbers', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      body: { email: user.email, tx_ref: txRef, bvn, narration, is_permanent: true, currency: 'NGN' },
    }, config);
    const result = await response.json().catch(() => null);
    const data = result?.data;
    const accountNumber = String(data?.account_number ?? '');
    const bankName = typeof data?.bank_name === 'string' ? data.bank_name.trim() : '';
    const accountStatus = String(data?.account_status ?? '').trim().toLowerCase();
    if (!response.ok || result?.status !== 'success' || !isAccountNumber(accountNumber) || !bankName
      || (!data?.flw_ref && !data?.order_ref) || (accountStatus && accountStatus !== 'active')) {
      console.warn('Flutterwave did not confirm a usable virtual account', { status: response.status });
      return json({ success: false, error: 'The bank couldn’t confirm your account. Check your BVN and try again.' }, 422);
    }

    const providerAccount = {
      account_number: accountNumber, bank_name: bankName,
      flw_ref: data.flw_ref, order_ref: data.order_ref, account_reference: data.account_reference,
    };
    if (groupTarget) {
      const { data: groupAccount, error } = await supabaseAdmin.rpc('service_save_group_bank_account', {
        p_user_id: user.id, p_group_id: groupTarget, p_account: providerAccount,
      });
      if (error || !groupAccount) return json({ success: false, error: 'Couldn’t finish setting up this group bank account.' }, 503);
      return json({ success: true, data: groupAccount });
    }

    const { data: completed, error: completeError } = await supabaseAdmin.rpc('service_complete_wallet_bank_account', {
      p_user_id: user.id,
      p_bvn: bvn,
      p_live: config.mode === 'live' && !config.secretKey.startsWith('FLWSECK_TEST'),
      p_verification_id: verificationId ?? null,
      p_account: {
        accountNumber, bankName, accountName: name, flwRef: data.flw_ref, orderRef: data.order_ref,
        accountReference: data.account_reference, createdAt: new Date().toISOString(),
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
