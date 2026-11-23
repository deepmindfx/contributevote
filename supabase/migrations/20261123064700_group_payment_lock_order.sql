BEGIN;

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
    PERFORM 1 FROM public.profiles WHERE id=v_checkout.user_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Checkout owner is unavailable'; END IF;
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
  v_creator uuid;
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
  SELECT creator_id INTO v_creator FROM public.contribution_groups WHERE id=p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group account could not be resolved'; END IF;
  IF v_creator IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE id=v_creator FOR KEY SHARE;
  END IF;
  SELECT * INTO v_group FROM public.contribution_groups WHERE id=p_group_id FOR UPDATE;
  IF NOT FOUND OR v_group.creator_id IS DISTINCT FROM v_creator THEN
    RAISE EXCEPTION 'Group account changed during settlement';
  END IF;

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
  SELECT * INTO v_group FROM public.contribution_groups WHERE id = v_payment.group_id;
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
    WHERE p.id = v_account::uuid AND coalesce(p.status,'active') = 'active' AND u.email_confirmed_at IS NOT NULL FOR KEY SHARE OF p;
  ELSE
    SELECT p.id INTO v_recipient FROM public.profiles p JOIN auth.users u ON p.id = u.id
    WHERE lower(u.email) = v_account AND coalesce(p.status,'active') = 'active' AND u.email_confirmed_at IS NOT NULL FOR KEY SHARE OF p;
  END IF;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'The contributor must register and verify their email before this transfer can be assigned'; END IF;

  SELECT * INTO v_group FROM public.contribution_groups WHERE id=v_payment.group_id FOR UPDATE;
  IF NOT FOUND OR (v_group.creator_id IS DISTINCT FROM auth.uid() AND NOT coalesce(public.is_admin(),false)) THEN
    RAISE EXCEPTION 'Group administrator access required';
  END IF;

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

NOTIFY pgrst, 'reload schema';
COMMIT;
