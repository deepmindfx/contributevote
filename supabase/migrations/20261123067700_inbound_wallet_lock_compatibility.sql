BEGIN;

CREATE OR REPLACE FUNCTION public.service_apply_verified_inbound(
  p_user_id uuid,p_group_id uuid,p_reference text,p_provider_id text,p_amount numeric,
  p_currency text,p_method text,p_destination text,p_metadata jsonb,p_anonymous boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_ids text[];
  v_alias text;
  v_existing public.transactions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_group public.contribution_groups%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_tx uuid;
  v_risk text;
BEGIN
  IF p_user_id IS NULL OR length(trim(coalesce(p_reference,''))) NOT BETWEEN 1 AND 180 OR
    p_currency IS DISTINCT FROM 'NGN' OR p_amount IS NULL OR p_amount NOT BETWEEN 0.01 AND 9999999999999.99
    OR p_amount<>round(p_amount,2) OR (p_destination IS NOT NULL AND p_destination !~ '^[0-9]{10}$') THEN
    RAISE EXCEPTION 'A verified NGN payment and a stable provider reference are required';
  END IF;

  v_ids := ARRAY(SELECT DISTINCT candidate FROM unnest(ARRAY[p_reference,nullif(trim(p_provider_id),''),
    nullif(trim(p_metadata->>'paymentReference'),''),nullif(trim(p_metadata->>'transactionReference'),'')]) candidate
    WHERE candidate IS NOT NULL AND length(candidate)<=180 ORDER BY candidate);

  FOREACH v_alias IN ARRAY v_ids LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_alias,0));
  END LOOP;
  SELECT t.* INTO v_existing FROM public.transactions t
    WHERE t.id IN (SELECT a.transaction_id FROM public.flutterwave_payment_aliases a WHERE a.alias=ANY(v_ids))
       OR (t.status='completed' AND t.type IN ('deposit','contribution') AND
         (t.reference_id=ANY(v_ids) OR (t.metadata->>'flutterwaveId')=ANY(v_ids)))
    ORDER BY t.created_at,t.id LIMIT 1;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id OR v_existing.contribution_id IS DISTINCT FROM p_group_id
      OR v_existing.amount IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Payment identity does not match the existing credit'; END IF;
    INSERT INTO public.flutterwave_payment_aliases(alias,transaction_id)
      SELECT a,v_existing.id FROM unnest(v_ids) a ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('alreadyProcessed',true,'amount',v_existing.amount,'contributionId',p_group_id,
      'transactionId',v_existing.id,'balanceAfter',v_existing.balance_after);
  END IF;
  IF EXISTS (SELECT FROM public.external_payment_tracks WHERE reference_id=ANY(v_ids)) THEN
    RAISE EXCEPTION 'Payment reference already recorded';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=p_user_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment recipient is unavailable'; END IF;
  IF p_group_id IS NULL THEN
    IF p_destination IS NOT NULL AND p_destination IS DISTINCT FROM (v_profile.preferences#>>'{virtualAccount,accountNumber}')
      AND p_destination IS DISTINCT FROM (v_profile.preferences#>>'{virtualAccount,accounts,0,accountNumber}') THEN
      RAISE EXCEPTION 'Payment destination does not match the wallet';
    END IF;
    v_before:=coalesce(v_profile.wallet_balance,0);
    v_after:=v_before+p_amount;
    UPDATE public.profiles SET wallet_balance=v_after,updated_at=now() WHERE id=p_user_id;
  ELSE
    SELECT * INTO v_group FROM public.contribution_groups WHERE id=p_group_id FOR UPDATE;
    IF NOT FOUND OR (p_destination IS NOT NULL AND v_group.account_number IS DISTINCT FROM p_destination) THEN
      RAISE EXCEPTION 'Payment destination does not match the group';
    END IF;
    UPDATE public.contribution_groups SET current_amount=coalesce(current_amount,0)+p_amount,updated_at=now() WHERE id=p_group_id;
    INSERT INTO public.contributors(group_id,user_id,amount,total_contributed,contribution_count,has_voting_rights,join_method,anonymous,last_contribution_at)
      VALUES(p_group_id,p_user_id,p_amount,p_amount,1,true,'app_checkout',coalesce(p_anonymous,false),now())
    ON CONFLICT(group_id,user_id) DO UPDATE SET total_contributed=coalesce(public.contributors.total_contributed,0)+p_amount,
      amount=coalesce(public.contributors.amount,0)+p_amount,contribution_count=coalesce(public.contributors.contribution_count,0)+1,
      has_voting_rights=true,anonymous=coalesce(public.contributors.anonymous,false) OR coalesce(p_anonymous,false),
      last_contribution_at=now(),updated_at=now();
  END IF;

  INSERT INTO public.transactions(user_id,contribution_id,type,amount,description,status,payment_method,reference_id,balance_before,balance_after,anonymous,metadata)
    VALUES(p_user_id,p_group_id,CASE WHEN p_group_id IS NULL THEN 'deposit' ELSE 'contribution' END,
      p_amount,CASE WHEN p_group_id IS NULL THEN 'Wallet funding via Flutterwave' ELSE 'Group contribution via Flutterwave' END,
      'completed',coalesce(p_method,'card'),p_reference,v_before,v_after,coalesce(p_anonymous,false),
      coalesce(p_metadata,'{}') || jsonb_build_object('flutterwaveId',p_provider_id,'votingRightsGranted',p_group_id IS NOT NULL))
    RETURNING id INTO v_tx;
  INSERT INTO public.flutterwave_payment_aliases(alias,transaction_id) SELECT a,v_tx FROM unnest(v_ids) a;
  v_risk:=CASE WHEN p_amount>=2000000 THEN 'critical' WHEN p_amount>=500000 THEN 'high'
    WHEN p_amount>=250000 THEN 'medium' ELSE 'low' END;
  INSERT INTO public.external_payment_tracks(reference_id,source_channel,group_id,user_id,transaction_id,amount,sender_name,sender_bank,
    sender_account_masked,destination_account,verification_status,aml_risk_level,raw_metadata)
  VALUES(p_reference,CASE WHEN p_method='bank_transfer' THEN
    CASE WHEN p_group_id IS NULL THEN 'wallet_bank_transfer' ELSE 'group_bank_transfer' END ELSE 'card_checkout' END,
    p_group_id,p_user_id,v_tx,p_amount,p_metadata->>'senderName',p_metadata->>'senderBank',p_metadata->>'senderAccount',
    p_destination,'verified',v_risk,coalesce(p_metadata,'{}'));
  IF v_risk IN ('critical','high') THEN
    INSERT INTO public.aml_alerts(alert_key,user_id,group_id,transaction_id,alert_type,severity,status,risk_score,amount,title,description)
    VALUES('verified_inbound:' || p_reference,p_user_id,p_group_id,v_tx,'external_payment_risk',v_risk,'open',
      CASE WHEN v_risk='critical' THEN 92 ELSE 78 END,p_amount,'High-value incoming payment','Incoming Flutterwave payment requires review.')
    ON CONFLICT(alert_key) DO NOTHING;
  END IF;
  INSERT INTO public.notifications(user_id,type,title,message,related_id)
  SELECT CASE WHEN p_group_id IS NULL THEN p_user_id ELSE v_group.creator_id END,
    CASE WHEN p_group_id IS NULL THEN 'wallet_deposit' ELSE 'group_payment_received' END,
    'Money received','₦' || p_amount || CASE WHEN p_group_id IS NULL THEN ' was added to your wallet.' ELSE ' was added to your group.' END,p_group_id
  WHERE p_group_id IS NULL OR v_group.creator_id IS NOT NULL;
  RETURN jsonb_build_object('alreadyProcessed',false,'amount',p_amount,'contributionId',p_group_id,'transactionId',v_tx,'balanceAfter',v_after);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
