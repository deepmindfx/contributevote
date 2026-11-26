-- Migration: store Flutterwave customer name in checkout transaction metadata
-- Adds p_metadata jsonb param to service_apply_checkout so the Edge Functions
-- can pass customerName (from flwData.customer.name) for display in receipts.
BEGIN;

CREATE OR REPLACE FUNCTION public.service_apply_checkout(
  p_reference text, p_provider_reference text, p_amount numeric, p_currency text, p_method text,
  p_expected_user uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
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

  -- Build base metadata and merge caller-supplied extras (e.g. customerName from Flutterwave customer object)
  INSERT INTO public.transactions (user_id,contribution_id,type,amount,status,payment_method,reference_id,description,balance_before,balance_after,anonymous,metadata)
  VALUES (v_checkout.user_id,v_checkout.group_id,CASE WHEN v_checkout.group_id IS NULL THEN 'deposit' ELSE 'contribution' END,
    v_checkout.amount,'completed',coalesce(p_method,'card'),p_provider_reference,
    CASE WHEN v_checkout.group_id IS NULL THEN 'Wallet funding through CollectiPay' ELSE 'Contribution through CollectiPay checkout' END,
    v_before,v_after,v_checkout.anonymous,
    jsonb_build_object('txRef',p_reference,'votingRightsGranted',v_checkout.group_id IS NOT NULL)
    || coalesce(p_metadata, '{}'::jsonb))
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

-- Update grants to include the new overloaded signature
REVOKE EXECUTE ON FUNCTION public.service_apply_checkout(text,text,numeric,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_apply_checkout(text,text,numeric,text,text,uuid,jsonb) TO service_role;

COMMIT;
