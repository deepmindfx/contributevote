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
  -- Serialize the provider identity across checkout, wallet and group-bank credits.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_provider_reference,0));
  IF EXISTS (SELECT FROM public.flutterwave_payment_aliases WHERE alias=p_provider_reference)
    OR EXISTS (
      SELECT FROM public.transactions t WHERE t.type IN ('deposit','contribution') AND t.status='completed'
        AND (t.reference_id=p_provider_reference OR t.metadata->>'flutterwaveId'=p_provider_reference)
    ) THEN RAISE EXCEPTION 'The provider payment already belongs to another ledger entry'; END IF;

  -- Claim the provider payment before any balances change.
  UPDATE public.checkout_intents SET provider_reference = p_provider_reference WHERE reference = p_reference;

  IF v_checkout.group_id IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE id=v_checkout.user_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Checkout owner is unavailable'; END IF;
    UPDATE public.contribution_groups g SET current_amount=coalesce(g.current_amount,0)+v_checkout.amount,updated_at=now()
    WHERE g.id=v_checkout.group_id AND g.status='active' AND NOT coalesce(g.archived,false)
      AND (g.privacy='public' OR g.creator_id=v_checkout.user_id OR EXISTS (
        SELECT FROM public.contributors c WHERE c.group_id=g.id AND c.user_id=v_checkout.user_id
      ));
    IF NOT FOUND THEN RAISE EXCEPTION 'Verified payment requires review because the group is no longer eligible'; END IF;
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
  INSERT INTO public.flutterwave_payment_aliases(alias,transaction_id) VALUES(p_provider_reference,v_tx);
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

CREATE OR REPLACE FUNCTION public.service_decide_payout_recovery(p_admin_id uuid,p_review_id uuid,p_approve boolean,p_pin text,p_provider_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_review public.payout_recovery_reviews%ROWTYPE;
  v_transfer public.transactions%ROWTYPE;
  v_owner uuid;
  v_wallet numeric;
  v_debit numeric;
  v_fee numeric;
  v_vat numeric;
  v_credit uuid;
  v_pin json;
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=p_admin_id AND role='admin' AND status='active')
    THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Choose a review decision.'; END IF;
  SELECT t.user_id INTO v_owner FROM public.payout_recovery_reviews r
    JOIN public.transactions t ON t.id=r.transaction_id WHERE r.id=p_review_id;
  IF NOT FOUND OR v_owner IS NULL THEN RAISE EXCEPTION 'Payout review is unavailable.'; END IF;
  PERFORM 1 FROM public.profiles WHERE id IN (p_admin_id,v_owner) ORDER BY id FOR NO KEY UPDATE;
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=p_admin_id AND role='admin' AND status='active')
    THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  v_pin:=public.check_wallet_pin(p_admin_id,p_pin);
  IF v_pin->>'success' IS DISTINCT FROM 'true' THEN RETURN v_pin::jsonb; END IF;
  SELECT coalesce(wallet_balance,0) INTO v_wallet FROM public.profiles WHERE id=v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet unavailable.'; END IF;
  SELECT * INTO v_review FROM public.payout_recovery_reviews WHERE id=p_review_id FOR UPDATE;
  IF v_review.status<>'pending' THEN RETURN jsonb_build_object('status',v_review.status); END IF;

  IF p_approve THEN
    IF v_review.submitted_by=p_admin_id OR v_owner=v_review.submitted_by OR v_owner=p_admin_id THEN
      RAISE EXCEPTION 'Two independent administrators must review this payout.';
    END IF;
    IF p_provider_status IS NULL OR NOT (
      (v_review.basis='not_debited' AND p_provider_status IN ('FAILED','CANCELLED','CANCELED'))
      OR (v_review.basis='reversed' AND p_provider_status='REVERSED')
    ) THEN
      RAISE EXCEPTION 'A compatible provider status is required.';
    END IF;
    SELECT * INTO v_transfer FROM public.transactions WHERE id=v_review.transaction_id FOR UPDATE;
    IF NOT FOUND OR v_transfer.user_id IS DISTINCT FROM v_owner OR v_transfer.type<>'transfer'
      OR v_transfer.status IS DISTINCT FROM 'pending' OR v_transfer.metadata->>'pricing_reserved' IS DISTINCT FROM 'true'
      OR NOT (v_transfer.metadata ? 'dispatched_at') THEN
      RAISE EXCEPTION 'The payout status changed. Refresh the provider records.';
    END IF;
    v_fee:=coalesce((v_transfer.metadata->>'fee')::numeric,0);
    v_vat:=coalesce((v_transfer.metadata->>'vat')::numeric,0);
    v_debit:=(v_transfer.metadata->>'total_debited')::numeric;
    IF v_debit IS NULL OR v_debit IS DISTINCT FROM v_transfer.amount+v_fee+v_vat
      OR v_transfer.balance_before-v_transfer.balance_after IS DISTINCT FROM v_debit OR v_debit<=0 THEN
      RAISE EXCEPTION 'The original wallet debit could not be verified.';
    END IF;

    UPDATE public.profiles SET wallet_balance=v_wallet+v_debit,updated_at=now() WHERE id=v_owner;
    INSERT INTO public.transactions(user_id,type,amount,description,status,payment_method,reference_id,balance_before,balance_after,metadata)
      VALUES(v_owner,'refund',v_debit,'Bank payout returned to wallet','completed','bank_payout_recovery',
        'PAYOUT_RECOVERY_'||v_transfer.id,v_wallet,v_wallet+v_debit,
        jsonb_build_object('payout_reference',v_transfer.reference_id,'payout_recovery_id',v_review.id,
          'principal',v_transfer.amount,'fee_returned',v_fee,'vat_returned',v_vat))
      RETURNING id INTO v_credit;
    UPDATE public.transactions SET status='failed',updated_at=now(),metadata=metadata ||
      jsonb_build_object('payout_recovery_id',v_review.id,'complete_message','The payout was reconciled and the wallet debit was returned.')
      WHERE id=v_transfer.id;
    INSERT INTO public.notifications(user_id,type,title,message)
      VALUES(v_owner,'transfer_failed','Bank transfer returned',format('₦%s was returned to your wallet after bank reconciliation.',v_debit));
  END IF;

  UPDATE public.payout_recovery_reviews SET status=CASE WHEN p_approve THEN 'approved' ELSE 'cancelled' END,
    reviewed_by=p_admin_id,reviewed_at=now(),credit_transaction_id=v_credit,provider_status=p_provider_status
    WHERE id=v_review.id RETURNING status INTO v_review.status;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
    VALUES(p_admin_id,'payout_recovery_'||v_review.status,'transaction',v_review.transaction_id::text,
      'Recorded an independent payout review decision.',
      jsonb_build_object('review_id',v_review.id,'credit_transaction_id',v_credit,'provider_status',p_provider_status));
  RETURN jsonb_build_object('status',v_review.status);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
