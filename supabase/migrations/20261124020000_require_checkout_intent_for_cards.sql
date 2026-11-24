BEGIN;

ALTER TABLE public.inbound_payment_review DROP CONSTRAINT inbound_payment_review_reason_check;
ALTER TABLE public.inbound_payment_review ADD CONSTRAINT inbound_payment_review_reason_check
  CHECK (reason IN ('destination_unresolved','settlement_failed','missing_checkout_intent'));

CREATE FUNCTION public.service_find_settled_inbound(p_provider_id text,p_reference text,p_amount numeric,p_expected_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('amount',t.amount,'transactionId',t.id,'contributionId',t.contribution_id,'alreadyProcessed',true)
  FROM public.transactions t
  WHERE p_provider_id ~ '^[1-9][0-9]{0,19}$' AND t.status='completed'
    AND t.type IN ('deposit','contribution') AND t.amount=p_amount
    AND (p_expected_user IS NULL OR t.user_id=p_expected_user)
    AND (t.id IN (SELECT a.transaction_id FROM public.flutterwave_payment_aliases a WHERE a.alias=p_provider_id)
      OR t.metadata->>'flutterwaveId'=p_provider_id
      OR (nullif(p_reference,'') IS NOT NULL AND t.reference_id=p_reference
        AND EXISTS(SELECT FROM public.external_payment_tracks e WHERE e.reference_id=p_reference
          AND e.transaction_id=t.id AND e.verification_status='verified')))
  ORDER BY t.created_at,t.id LIMIT 1;
$$;

-- Restrict the credit RPC itself so a stale Edge deployment cannot settle a card payment by metadata.
ALTER FUNCTION public.service_apply_verified_inbound(uuid,uuid,text,text,numeric,text,text,text,jsonb,boolean)
  RENAME TO internal_apply_verified_wallet_credit;
REVOKE ALL ON FUNCTION public.internal_apply_verified_wallet_credit(uuid,uuid,text,text,numeric,text,text,text,jsonb,boolean)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.service_apply_verified_inbound(p_user_id uuid,p_group_id uuid,p_reference text,
  p_provider_id text,p_amount numeric,p_currency text,p_method text,p_destination text,p_metadata jsonb,
  p_anonymous boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_group_id IS NOT NULL OR p_method IS DISTINCT FROM 'bank_transfer'
    OR p_destination IS NULL OR p_destination !~ '^[0-9]{10}$'
    OR p_provider_id IS NULL OR p_provider_id !~ '^[1-9][0-9]{0,19}$' THEN
    RAISE EXCEPTION 'A verified wallet virtual-account deposit is required.';
  END IF;
  RETURN public.internal_apply_verified_wallet_credit(
    p_user_id,NULL,p_reference,p_provider_id,p_amount,p_currency,'bank_transfer',p_destination,p_metadata,false);
END;
$$;

REVOKE ALL ON FUNCTION public.service_find_settled_inbound(text,text,numeric,uuid),
  public.service_apply_verified_inbound(uuid,uuid,text,text,numeric,text,text,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_find_settled_inbound(text,text,numeric,uuid),
  public.service_apply_verified_inbound(uuid,uuid,text,text,numeric,text,text,text,jsonb,boolean) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
