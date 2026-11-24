BEGIN;

CREATE TABLE public.inbound_payment_review (
  provider_id text PRIMARY KEY CHECK (provider_id ~ '^[1-9][0-9]{0,19}$'),
  provider_reference text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount>0),
  reason text NOT NULL CHECK (reason IN ('destination_unresolved','settlement_failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbound_payment_review ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbound_payment_review FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.inbound_payment_review TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.inbound_payment_review TO service_role;
CREATE POLICY "Active administrators can review incoming payments" ON public.inbound_payment_review FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX inbound_payment_review_due ON public.inbound_payment_review(next_attempt_at) WHERE resolved_at IS NULL;

CREATE FUNCTION public.service_resolve_virtual_account_payment(p_account text,p_reference text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH candidates AS (
    SELECT 'group' AS kind,g.id,g.account_number AS account FROM public.contribution_groups g
    WHERE g.account_number ~ '^[0-9]{10}$' AND (
      (p_account IS NOT NULL AND g.account_number=p_account) OR
      (p_account IS NULL AND p_reference IS NOT NULL AND
        p_reference IN ('GROUP_' || g.id || '_VA',g.account_reference))
    )
    UNION ALL
    SELECT 'wallet',p.id,coalesce(p_account,p.preferences#>>'{virtualAccount,accountNumber}',p.preferences#>>'{virtualAccount,accounts,0,accountNumber}')
    FROM public.profiles p
    WHERE (
      (p_account IS NOT NULL AND p_account IN (p.preferences#>>'{virtualAccount,accountNumber}',p.preferences#>>'{virtualAccount,accounts,0,accountNumber}'))
      OR (p_account IS NULL AND p_reference IS NOT NULL AND (
        p_reference IN (p.preferences#>>'{virtualAccount,txRef}',p.preferences#>>'{virtualAccount,accountReference}',p.preferences#>>'{virtualAccount,orderRef}')
        OR (p_reference ~ '^COLL_[a-f0-9-]{36}_[a-f0-9-]{36}$' AND split_part(p_reference,'_',2)=p.id::text)
      ))
    ) AND coalesce(p.preferences#>>'{virtualAccount,accountNumber}',p.preferences#>>'{virtualAccount,accounts,0,accountNumber}') ~ '^[0-9]{10}$'
  )
  SELECT CASE WHEN count(*)=1 THEN (jsonb_agg(to_jsonb(candidates)))->0 ELSE NULL END FROM candidates;
$$;

CREATE FUNCTION public.service_apply_verified_group_bank_payment(p_group_id uuid,p_destination text,p_provider_id text,
  p_reference text,p_amount numeric,p_currency text,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_aliases text[];
  v_alias text;
  v_existing uuid[];
  v_tx uuid;
  v_result jsonb;
BEGIN
  IF p_group_id IS NULL OR coalesce(p_destination,'') !~ '^[0-9]{10}$'
    OR coalesce(p_provider_id,'') !~ '^[1-9][0-9]{0,19}$' OR length(coalesce(p_reference,'')) NOT BETWEEN 1 AND 180
    OR p_currency IS DISTINCT FROM 'NGN' OR p_amount IS NULL OR p_amount NOT BETWEEN 0.01 AND 9999999999999.99
    OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'A verified group payment is required'; END IF;

  v_aliases := ARRAY(SELECT DISTINCT a FROM unnest(ARRAY[p_provider_id,p_reference]) a ORDER BY a);
  FOREACH v_alias IN ARRAY v_aliases LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_alias,0));
  END LOOP;
  SELECT array_agg(DISTINCT t.id) INTO v_existing FROM public.transactions t
    WHERE t.id IN (SELECT a.transaction_id FROM public.flutterwave_payment_aliases a WHERE a.alias=ANY(v_aliases))
      OR (t.status='completed' AND t.type IN ('deposit','contribution') AND
        (t.reference_id=ANY(v_aliases) OR t.metadata->>'flutterwaveId'=ANY(v_aliases)));
  IF coalesce(cardinality(v_existing),0)>0 THEN
    IF cardinality(v_existing)<>1 OR NOT EXISTS (
      SELECT FROM public.transactions t WHERE t.id=v_existing[1] AND t.status='completed' AND t.type='contribution'
        AND t.contribution_id=p_group_id AND t.amount=p_amount AND t.payment_method='bank_transfer'
        AND (t.metadata->>'outside_group_transfer'='true' OR t.metadata->>'requiresVerification'='true')
    ) THEN RAISE EXCEPTION 'Provider payment identity requires reconciliation'; END IF;
    v_tx:=v_existing[1];
    v_result:=jsonb_build_object('alreadyProcessed',true,'amount',p_amount,'groupId',p_group_id);
  ELSE
    -- Match the profile-before-group lock order used by refund and contribution writers.
    PERFORM 1 FROM public.profiles WHERE id=(SELECT creator_id FROM public.contribution_groups WHERE id=p_group_id) FOR KEY SHARE;
    PERFORM 1 FROM public.contribution_groups WHERE id=p_group_id AND account_number=p_destination FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment destination changed'; END IF;
    v_result:=public.service_record_outside_group_payment(p_group_id,p_reference,p_amount,
      p_metadata->>'senderName',p_metadata->>'senderBank',
      coalesce(p_metadata,'{}') || jsonb_build_object('accountNumber',p_destination,'flutterwaveId',p_provider_id));
    SELECT id INTO STRICT v_tx FROM public.transactions WHERE reference_id=p_reference AND contribution_id=p_group_id
      AND type='contribution' AND status='completed' AND amount=p_amount;
  END IF;
  INSERT INTO public.flutterwave_payment_aliases(alias,transaction_id)
    SELECT a,v_tx FROM unnest(v_aliases) a ON CONFLICT DO NOTHING;
  RETURN v_result || jsonb_build_object('transactionId',v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public.service_resolve_virtual_account_payment(text,text),
  public.service_apply_verified_group_bank_payment(uuid,text,text,text,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_resolve_virtual_account_payment(text,text),
  public.service_apply_verified_group_bank_payment(uuid,text,text,text,numeric,text,jsonb) TO service_role;

CREATE FUNCTION public.admin_list_pending_inbound_payments()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(pending) ORDER BY pending.created_at)
    FROM (
      SELECT provider_id,amount,reason,created_at FROM public.inbound_payment_review
      WHERE resolved_at IS NULL ORDER BY created_at LIMIT 50
    ) pending
  ),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_pending_inbound_payments() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_inbound_payments() TO authenticated;

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

NOTIFY pgrst,'reload schema';
COMMIT;
