BEGIN;

ALTER TABLE public.checkout_intents ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.service_apply_checkout(
  p_reference text, p_provider_reference text, p_amount numeric, p_currency text, p_method text,
  p_expected_user uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_checkout public.checkout_intents%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_tx uuid;
BEGIN
  SELECT * INTO v_checkout FROM public.checkout_intents WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND OR (p_expected_user IS NOT NULL AND p_expected_user IS DISTINCT FROM v_checkout.user_id) THEN
    RAISE EXCEPTION 'Checkout does not belong to this account';
  END IF;
  IF p_currency IS DISTINCT FROM 'NGN' OR p_amount IS DISTINCT FROM v_checkout.amount
    OR nullif(trim(p_provider_reference),'') IS NULL THEN
    RAISE EXCEPTION 'Verified payment does not match the checkout';
  END IF;
  IF v_checkout.processed_at IS NOT NULL THEN
    IF p_provider_reference IS DISTINCT FROM v_checkout.provider_reference THEN RAISE EXCEPTION 'Payment reference mismatch'; END IF;
    RETURN jsonb_build_object('amount',v_checkout.amount,'contributionId',v_checkout.group_id,'alreadyProcessed',true);
  END IF;
  -- Claim the provider payment before any balances change.
  UPDATE public.checkout_intents SET provider_reference = p_provider_reference WHERE reference = p_reference;

  IF v_checkout.group_id IS NOT NULL THEN
    UPDATE public.contribution_groups SET current_amount = coalesce(current_amount,0) + v_checkout.amount, updated_at = now()
    WHERE id = v_checkout.group_id;
    INSERT INTO public.contributors
      (group_id,user_id,amount,total_contributed,contribution_count,has_voting_rights,join_method,anonymous,last_contribution_at)
    VALUES (v_checkout.group_id,v_checkout.user_id,v_checkout.amount,v_checkout.amount,1,true,'app_checkout',v_checkout.anonymous,now())
    ON CONFLICT (group_id,user_id) DO UPDATE
    SET amount = coalesce(public.contributors.amount,0) + EXCLUDED.amount,
      total_contributed = coalesce(public.contributors.total_contributed,0) + EXCLUDED.total_contributed,
      contribution_count = coalesce(public.contributors.contribution_count,0) + 1, has_voting_rights = true,
      anonymous = coalesce(public.contributors.anonymous,false) OR EXCLUDED.anonymous,
      last_contribution_at = now(), updated_at = now();
  ELSE
    SELECT coalesce(wallet_balance,0) INTO v_before FROM public.profiles WHERE id = v_checkout.user_id FOR UPDATE;
    v_after := v_before + v_checkout.amount;
    UPDATE public.profiles SET wallet_balance = v_after, updated_at = now() WHERE id = v_checkout.user_id;
  END IF;

  INSERT INTO public.transactions (user_id,contribution_id,type,amount,status,payment_method,reference_id,description,balance_before,balance_after,anonymous,metadata)
  VALUES (v_checkout.user_id,v_checkout.group_id,CASE WHEN v_checkout.group_id IS NULL THEN 'deposit' ELSE 'contribution' END,
    v_checkout.amount,'completed',coalesce(p_method,'card'),p_provider_reference,
    CASE WHEN v_checkout.group_id IS NULL THEN 'Wallet funding through CollectiPay' ELSE 'Contribution through CollectiPay checkout' END,
    v_before,v_after,v_checkout.anonymous,jsonb_build_object('txRef',p_reference,'votingRightsGranted',v_checkout.group_id IS NOT NULL))
  RETURNING id INTO v_tx;
  UPDATE public.checkout_intents SET processed_at = now(), transaction_id = v_tx WHERE reference = p_reference;

  INSERT INTO public.external_payment_tracks (reference_id,source_channel,group_id,user_id,transaction_id,amount,verification_status,aml_risk_level)
  VALUES (p_provider_reference,'card_checkout',v_checkout.group_id,v_checkout.user_id,v_tx,v_checkout.amount,'verified',
    CASE WHEN v_checkout.amount >= 2000000 THEN 'critical' WHEN v_checkout.amount >= 500000 THEN 'high'
      WHEN v_checkout.amount >= 250000 THEN 'medium' ELSE 'low' END)
  ON CONFLICT (reference_id) DO NOTHING;
  IF v_checkout.amount >= 500000 THEN
    INSERT INTO public.aml_alerts (alert_key,user_id,group_id,transaction_id,alert_type,severity,status,risk_score,amount,title,description)
    VALUES ('checkout:' || p_reference,v_checkout.user_id,v_checkout.group_id,v_tx,'external_payment_risk',
      CASE WHEN v_checkout.amount >= 2000000 THEN 'critical' ELSE 'high' END,'open',
      CASE WHEN v_checkout.amount >= 2000000 THEN 92 ELSE 78 END,v_checkout.amount,
      'High-value checkout', 'CollectiPay checkout requires a compliance review.')
    ON CONFLICT (alert_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('amount',v_checkout.amount,'contributionId',v_checkout.group_id,'alreadyProcessed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_record_outside_group_payment(
  p_group_id uuid, p_reference text, p_amount numeric, p_sender_name text, p_sender_bank text, p_metadata jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_group public.contribution_groups%ROWTYPE;
  v_tx uuid;
  v_risk text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount,2) OR nullif(trim(p_reference),'') IS NULL THEN
    RAISE EXCEPTION 'A confirmed payment reference and amount are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reference,0));
  IF EXISTS (SELECT 1 FROM public.external_payment_tracks WHERE reference_id = p_reference) OR EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference_id = p_reference AND contribution_id = p_group_id
      AND type = 'contribution' AND payment_method = 'bank_transfer' AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object('alreadyProcessed',true);
  END IF;
  SELECT * INTO v_group FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group account could not be resolved'; END IF;

  INSERT INTO public.transactions (user_id,contribution_id,type,amount,status,payment_method,reference_id,description,metadata)
  VALUES (v_group.creator_id,p_group_id,'contribution',p_amount,'completed','bank_transfer',p_reference,
    'Bank transfer to ' || v_group.name,coalesce(p_metadata,'{}'::jsonb) ||
    jsonb_build_object('senderName',p_sender_name,'senderBank',p_sender_bank,'paymentReference',p_reference,
      'requiresVerification',true,'votingRightsGranted',false,'outside_group_transfer',true))
  RETURNING id INTO v_tx;
  v_risk := CASE WHEN p_amount >= 2000000 THEN 'critical' WHEN p_amount >= 250000 THEN 'high' ELSE 'low' END;
  INSERT INTO public.external_payment_tracks
    (reference_id,source_channel,group_id,transaction_id,amount,sender_name,sender_bank,sender_account_masked,
      destination_account,verification_status,aml_risk_level,aml_flags)
  VALUES (p_reference,'group_bank_transfer',p_group_id,v_tx,p_amount,p_sender_name,p_sender_bank,p_metadata->>'senderAccount',
    p_metadata->>'accountNumber','unverified',v_risk,'["unlinked_external_sender"]'::jsonb);
  INSERT INTO public.contributors
    (group_id,user_id,amount,total_contributed,contribution_count,has_voting_rights,join_method,anonymous,last_contribution_at,metadata)
  VALUES (p_group_id,NULL,p_amount,p_amount,1,false,'bank_transfer',true,now(),
    jsonb_build_object('senderName',p_sender_name,'senderBank',p_sender_bank,'paymentReference',p_reference));
  UPDATE public.contribution_groups SET current_amount = coalesce(current_amount,0) + p_amount, updated_at = now()
  WHERE id = p_group_id;
  IF v_group.creator_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id,type,title,message,related_id)
    VALUES (v_group.creator_id,'bank_transfer_received','Group bank transfer received',
      format('₦%s arrived in %s. Open the group to review the transfer.',
        to_char(p_amount,'FM999,999,999,990.00'),v_group.name),p_group_id);
  END IF;
  IF v_risk <> 'low' THEN
    INSERT INTO public.aml_alerts (alert_key,user_id,group_id,transaction_id,alert_type,severity,status,risk_score,amount,title,description)
    VALUES ('ext_webhook:' || p_reference,v_group.creator_id,p_group_id,v_tx,'external_payment_risk',v_risk,'open',
      CASE WHEN v_risk = 'critical' THEN 92 ELSE 78 END,p_amount,'Outside bank transfer',
      'An unassigned group bank transfer requires a compliance review.')
    ON CONFLICT (alert_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('alreadyProcessed',false,'amount',p_amount,'groupId',p_group_id);
END;
$$;

-- A previously assigned historical payment no longer has a standalone sender row.
CREATE OR REPLACE FUNCTION public.unassigned_group_bank_contributor(
  p_group_id uuid, p_reference text, p_amount numeric, p_sender_name text, p_created_at timestamptz
)
RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT id, CASE WHEN metadata->>'paymentReference' = p_reference THEN 0 ELSE 1 END AS priority
    FROM public.contributors
    WHERE group_id = p_group_id AND user_id IS NULL AND join_method = 'bank_transfer'
      AND total_contributed = p_amount
      AND (metadata->>'paymentReference' = p_reference OR (
        metadata->>'paymentReference' IS NULL
        AND nullif(metadata->>'senderName','') = nullif(p_sender_name,'')
        AND abs(extract(epoch from (joined_at - p_created_at))) <= 300
      ))
  )
  SELECT (array_agg(id))[1] FROM candidates
  WHERE priority = (SELECT min(priority) FROM candidates)
  HAVING count(*) = 1;
$$;
REVOKE EXECUTE ON FUNCTION public.unassigned_group_bank_contributor(uuid,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_group_bank_transfer_assignments(p_group_id uuid)
RETURNS TABLE (id uuid, amount numeric, sender_name text, sender_bank text, reference_id text, created_at timestamptz, verification_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(public.is_admin(),false) OR EXISTS (
    SELECT 1 FROM public.contribution_groups g WHERE g.id = p_group_id AND g.creator_id = auth.uid()
  )) THEN RAISE EXCEPTION 'Group administrator access required'; END IF;
  RETURN QUERY SELECT e.id,e.amount,e.sender_name,e.sender_bank,e.reference_id,e.created_at,e.verification_status
  FROM public.external_payment_tracks e JOIN public.transactions t ON t.id = e.transaction_id
  WHERE e.group_id = p_group_id AND e.source_channel = 'group_bank_transfer' AND e.contribution_assigned_at IS NULL
    AND e.verification_status <> 'blocked' AND t.status = 'completed' AND t.type = 'contribution' AND t.contribution_id = p_group_id
    AND t.amount = e.amount AND t.reference_id = e.reference_id
    AND public.unassigned_group_bank_contributor(e.group_id,e.reference_id,e.amount,e.sender_name,e.created_at) IS NOT NULL
  ORDER BY e.created_at DESC LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_group_bank_transfer(p_payment_id uuid, p_account text, p_grant_vote boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_payment public.external_payment_tracks%ROWTYPE;
  v_group public.contribution_groups%ROWTYPE;
  v_recipient uuid;
  v_account text := lower(btrim(p_account));
  v_anonymous_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_account IS NULL OR v_account = '' OR p_grant_vote IS NULL THEN
    RAISE EXCEPTION 'Select a payment and enter a registered member’s email or user ID';
  END IF;
  SELECT * INTO v_payment FROM public.external_payment_tracks WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.source_channel <> 'group_bank_transfer' OR v_payment.group_id IS NULL THEN
    RAISE EXCEPTION 'Confirmed outside bank transfer not found';
  END IF;
  SELECT * INTO v_group FROM public.contribution_groups WHERE id = v_payment.group_id FOR UPDATE;
  IF NOT FOUND OR (v_group.creator_id IS DISTINCT FROM auth.uid() AND NOT coalesce(public.is_admin(),false)) THEN
    RAISE EXCEPTION 'Group administrator access required';
  END IF;
  IF v_payment.contribution_assigned_at IS NOT NULL THEN RAISE EXCEPTION 'This transfer is already assigned'; END IF;
  IF v_payment.verification_status = 'blocked'
    OR (v_payment.verification_status = 'flagged' AND NOT coalesce(public.is_admin(),false)) THEN
    RAISE EXCEPTION 'This payment needs platform review before it can be assigned';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions WHERE id = v_payment.transaction_id AND type = 'contribution' AND status = 'completed'
      AND contribution_id = v_group.id AND amount = v_payment.amount AND reference_id = v_payment.reference_id
  ) THEN RAISE EXCEPTION 'This transfer has no matching completed contribution'; END IF;

  IF v_account ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
    SELECT p.id INTO v_recipient FROM public.profiles p JOIN auth.users u ON p.id = u.id
    WHERE p.id = v_account::uuid AND coalesce(p.status,'active') = 'active' AND u.email_confirmed_at IS NOT NULL;
  ELSE
    SELECT p.id INTO v_recipient FROM public.profiles p JOIN auth.users u ON p.id = u.id
    WHERE lower(u.email) = v_account AND coalesce(p.status,'active') = 'active' AND u.email_confirmed_at IS NOT NULL;
  END IF;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'The contributor must register and verify their email before this transfer can be assigned'; END IF;

  v_anonymous_id := public.unassigned_group_bank_contributor(
    v_group.id,v_payment.reference_id,v_payment.amount,v_payment.sender_name,v_payment.created_at
  );
  IF v_anonymous_id IS NULL THEN
    RAISE EXCEPTION 'No matching unassigned contributor was found. This transfer may already be linked.';
  END IF;
  DELETE FROM public.contributors WHERE id = v_anonymous_id AND user_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This transfer has already been linked'; END IF;
  INSERT INTO public.contributors
    (group_id,user_id,amount,total_contributed,contribution_count,has_voting_rights,join_method,anonymous,last_contribution_at)
  VALUES (v_group.id,v_recipient,v_payment.amount,v_payment.amount,1,p_grant_vote,'verified_bank_transfer',false,now())
  ON CONFLICT (group_id,user_id) DO UPDATE
  SET amount = coalesce(public.contributors.amount,0) + EXCLUDED.amount,
    total_contributed = coalesce(public.contributors.total_contributed,0) + EXCLUDED.total_contributed,
    contribution_count = coalesce(public.contributors.contribution_count,0) + 1,
    has_voting_rights = coalesce(public.contributors.has_voting_rights,false) OR EXCLUDED.has_voting_rights,
    last_contribution_at = now(), updated_at = now();
  UPDATE public.transactions SET user_id = v_recipient,
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('requiresVerification',false,'votingRightsGranted',p_grant_vote),
    updated_at = now() WHERE id = v_payment.transaction_id;
  UPDATE public.external_payment_tracks SET assigned_contributor_id = v_recipient, contribution_assigned_at = now(),
    user_id = v_recipient, verification_status = 'verified', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_payment_id;
  INSERT INTO public.notifications (user_id,type,title,message,related_id)
  VALUES (v_recipient,'contribution_verified','Bank contribution verified',
    'Your bank contribution to ' || v_group.name || ' was linked to your account.',v_group.id);
END;
$$;

-- Follow wallet contribution lock order: profile before group.

CREATE OR REPLACE FUNCTION public.process_priced_instant_withdrawal(
  p_group_id uuid, p_amount numeric, p_purpose text, p_pin text, p_expected_fee numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  PERFORM 1 FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric IS DISTINCT FROM p_expected_fee THEN
    RAISE EXCEPTION 'The withdrawal fee changed. Reopen the withdrawal to review the updated amount.';
  END IF;
  PERFORM public.process_instant_withdrawal(p_group_id,auth.uid(),p_amount,p_purpose,p_pin);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_instant_withdrawal(
  p_group_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_admin record;
  v_stored_pin text;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(),current_user) <> 'service_role' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized withdrawal requester';
  END IF;

  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT id, wallet_balance, status, preferences INTO v_admin
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group.enable_voting_rights IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF v_group.creator_id <> p_admin_id THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Cannot withdraw while group is %', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END;
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  IF COALESCE(v_admin.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Your account is currently % and cannot withdraw funds', v_admin.status;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_stored_pin := COALESCE(v_admin.preferences, '{}'::jsonb)->>'transactionPin';
    IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Please set a 4-digit Transaction PIN to authorize withdrawals';
    END IF;
    IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
      RAISE EXCEPTION 'Incorrect 4-digit Transaction PIN';
    END IF;
  END IF;

  v_admin_balance_before := COALESCE(v_admin.wallet_balance, 0);
  v_fee := (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric;
  v_net := p_amount - v_fee;
  v_admin_balance_after := v_admin_balance_before + v_net;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = p_admin_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_admin_id, p_group_id, 'withdrawal', v_net,
    'Instant withdrawal: ' || trim(COALESCE(p_purpose, '')), 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || replace(p_group_id::text, '-', '') || '_' || gen_random_uuid()::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting',
      'pin_verified', true, 'gross_amount', p_amount, 'fee', v_fee, 'net_amount', v_net
    )
  ) RETURNING id INTO v_transaction_id;
  IF v_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount) VALUES (v_transaction_id,'group_withdrawal',v_fee);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id,
    'wallet_credit',
    'Withdrawal Credited',
    format('₦%s withdrawn from "%s" and added to your wallet.', to_char(v_net, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_approved_withdrawal(p_withdrawal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_withdrawal record;
  v_group record;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF v_withdrawal.status = 'executed' THEN
    RETURN json_build_object('success', true, 'status', 'executed', 'message', 'Withdrawal already executed');
  END IF;

  IF v_withdrawal.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not approved');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_admin_balance_before
  FROM public.profiles
  WHERE id = v_withdrawal.requester_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Withdrawal recipient not found'); END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;

  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contribution group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Group is not active; payout blocked pending compliance review');
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < v_withdrawal.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient group balance');
  END IF;

  v_fee := v_withdrawal.fee_amount;
  v_net := v_withdrawal.amount - v_fee;
  v_admin_balance_after := v_admin_balance_before + v_net;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - v_withdrawal.amount,
      updated_at = now()
  WHERE id = v_withdrawal.contribution_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = v_withdrawal.requester_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    v_withdrawal.requester_id, v_withdrawal.contribution_id, 'withdrawal',
    v_net, 'Withdrawal approved: ' || v_withdrawal.purpose,
    'completed', 'wallet', 'WITHDRAWAL_' || p_withdrawal_id::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'group_id', v_withdrawal.contribution_id,
      'purpose', v_withdrawal.purpose,
      'votes', v_withdrawal.votes, 'gross_amount', v_withdrawal.amount, 'fee', v_fee,
      'fee_percent', v_withdrawal.fee_percent, 'net_amount', v_net
    )
  ) RETURNING id INTO v_transaction_id;
  IF v_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount) VALUES (v_transaction_id,'group_withdrawal',v_fee);
  END IF;

  UPDATE public.withdrawal_requests
  SET status = 'executed', updated_at = now()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    v_withdrawal.requester_id,
    'wallet_credit',
    'Withdrawal Approved & Credited',
    format('₦%s from "%s" was approved by voters and credited to your wallet.',
      to_char(v_net, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_withdrawal.contribution_id,
    false
  );

  RETURN json_build_object(
    'success', true,
    'status', 'executed',
    'message', 'Withdrawal approved and credited to requester wallet',
    'amount', v_net, 'fee', v_fee, 'gross_amount', v_withdrawal.amount,
    'admin_new_balance', v_admin_balance_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.contribute_from_wallet(
  p_user_id uuid,
  p_group_id uuid,
  p_amount numeric,
  p_anonymous boolean DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user record;
  v_group record;
  v_stored_pin text;
  v_user_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_contributor_id uuid;
  v_ref text;
  v_anonymous boolean;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized contribution attempt');
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum contribution amount is ₦100');
  END IF;

  SELECT id, wallet_balance, status, name, preferences
  INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF COALESCE(v_user.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Your account is currently %s and cannot make contributions. Contact support.', v_user.status)
    );
  END IF;

  -- Enforce 4-digit Transaction PIN for interactive user contributions (cron service_role has auth.uid() IS NULL)
  IF v_caller IS NOT NULL THEN
    v_stored_pin := COALESCE(v_user.preferences, '{}'::jsonb)->>'transactionPin';
    IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
      RETURN json_build_object(
        'success', false,
        'pin_required', true,
        'error', 'Please set up a 4-digit Transaction PIN to authorize contributions.'
      );
    END IF;
    IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
      RETURN json_build_object(
        'success', false,
        'pin_invalid', true,
        'error', 'Incorrect 4-digit Transaction PIN.'
      );
    END IF;
  END IF;

  v_anonymous := coalesce(p_anonymous,(v_user.preferences->>'anonymousContributions') = 'true',false);
  v_user_balance := COALESCE(v_user.wallet_balance, 0);
  IF v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', v_user_balance,
      'required', p_amount
    );
  END IF;

  SELECT id, name, status, archived, current_amount, enable_voting_rights
  INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true THEN
    RETURN json_build_object('success', false, 'error', 'This group has been archived and is no longer accepting contributions');
  END IF;

  IF COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('This group is currently %s and cannot receive contributions', v_group.status)
    );
  END IF;

  v_new_balance := v_user_balance - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.contributors (
    group_id,
    user_id,
    amount,
    total_contributed,
    contribution_count,
    has_voting_rights,
    join_method,
    anonymous,
    joined_at,
    last_contribution_at
  ) VALUES (
    p_group_id,
    p_user_id,
    p_amount,
    p_amount,
    1,
    true,
    'wallet',
    v_anonymous,
    now(),
    now()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = COALESCE(public.contributors.total_contributed, 0) + p_amount,
      contribution_count = COALESCE(public.contributors.contribution_count, 0) + 1,
      has_voting_rights = true,
      anonymous = coalesce(public.contributors.anonymous,false) OR EXCLUDED.anonymous,
      last_contribution_at = now(),
      updated_at = now()
  RETURNING id INTO v_contributor_id;

  v_ref := 'WALLET_' || substr(p_user_id::text, 1, 8) || '_' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO public.transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group.name || ' from wallet',
    'completed',
    'wallet',
    v_ref,
    v_anonymous,
    v_user_balance,
    v_new_balance,
    jsonb_build_object(
      'source', 'wallet',
      'instant_voting_rights', COALESCE(v_group.enable_voting_rights, true),
      'contributor_id', v_contributor_id,
      'pin_verified', (v_caller IS NOT NULL)
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'reference', v_ref,
    'contributor_id', v_contributor_id,
    'new_balance', v_new_balance,
    'voting_rights_granted', COALESCE(v_group.enable_voting_rights, true)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Claim the transfer before contacting the provider. Only reservations that never
-- reached this claim can be released automatically without a provider result.
CREATE OR REPLACE FUNCTION public.service_claim_transfer_dispatch(p_reference text, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.transactions
  SET metadata = metadata || jsonb_build_object('dispatched_at',now()), updated_at = now()
  WHERE reference_id = p_reference AND user_id = p_user_id AND type = 'transfer' AND status = 'pending'
    AND metadata->>'dispatch_guard' = 'true' AND NOT (metadata ? 'dispatched_at');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_release_unsent_transfer(p_reference text, p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_transfer public.transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_transfer FROM public.transactions
  WHERE reference_id = p_reference AND user_id = p_user_id AND type = 'transfer' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_transfer.status = 'pending' AND v_transfer.metadata->>'dispatch_guard' = 'true'
    AND NOT (v_transfer.metadata ? 'dispatched_at') AND v_transfer.created_at < now() - interval '2 minutes' THEN
    RETURN public.service_settle_priced_transfer(p_reference,'failed','{"reason":"never_dispatched"}'::jsonb)->>'status';
  END IF;
  RETURN v_transfer.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.service_claim_transfer_dispatch(text,uuid),
  public.service_release_unsent_transfer(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_claim_transfer_dispatch(text,uuid),
  public.service_release_unsent_transfer(text,uuid) TO service_role;

COMMIT;
