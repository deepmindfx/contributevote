BEGIN;

CREATE OR REPLACE FUNCTION public.service_settle_priced_transfer(p_reference text, p_status text, p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_transfer public.transactions%ROWTYPE;
  v_batch public.bulk_transfer_batches%ROWTYPE;
  v_details jsonb := coalesce(p_details,'{}'::jsonb) - ARRAY['pricing_reserved','total_debited','fee','fee_reason',
    'dispatch_guard','dispatched_at','account_number','account_bank','beneficiary_name','narration','vat','vat_percent',
    'row_number','bulk_provider_failure','transfer_provider_failure'];
  v_fee numeric;
  v_refund numeric;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','completed','failed') THEN RAISE EXCEPTION 'Invalid transfer status'; END IF;
  SELECT user_id INTO v_owner FROM public.transactions WHERE type = 'transfer' AND reference_id = p_reference;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_owner FOR UPDATE;

  SELECT * INTO v_transfer FROM public.transactions
  WHERE type = 'transfer' AND user_id = v_owner AND reference_id = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  IF v_transfer.status IN ('completed','failed') THEN
    RETURN jsonb_build_object('found',true,'status',v_transfer.status);
  END IF;
  IF v_transfer.bulk_batch_id IS NOT NULL THEN
    -- Dispatch, settlement and expiry all hold the wallet lock. Once dispatch is
    -- claimed, an external status is never sufficient evidence to credit the wallet.
    SELECT * INTO v_batch FROM public.bulk_transfer_batches
      WHERE id=v_transfer.bulk_batch_id AND user_id=v_owner AND authorized_at IS NOT NULL FOR UPDATE;
    IF NOT FOUND OR v_transfer.metadata->>'dispatch_guard' IS DISTINCT FROM 'true' THEN
      RETURN jsonb_build_object('found',true,'status',v_transfer.status);
    END IF;

    IF p_status='failed' THEN
      IF v_batch.dispatch_started_at IS NOT NULL OR v_batch.provider_batch_id IS NOT NULL
        OR v_transfer.metadata ? 'dispatched_at' THEN
        IF p_details->>'provider_checked'='true' AND NOT (v_transfer.metadata ? 'bulk_provider_failure') THEN
          UPDATE public.transactions SET metadata=metadata || jsonb_build_object('bulk_provider_failure',
            jsonb_build_object('observed_at',now(),'provider_id',left(p_details->>'flutterwave_id',20),
              'message',left(p_details->>'complete_message',240))), updated_at=now() WHERE id=v_transfer.id;
        ELSE
          UPDATE public.transactions SET updated_at=now() WHERE id=v_transfer.id;
        END IF;
        RETURN jsonb_build_object('found',true,'status',v_transfer.status);
      END IF;

      IF p_details->>'reason' IS DISTINCT FROM 'never_dispatched'
        OR v_transfer.created_at IS NULL OR v_transfer.created_at>=now()-interval '2 minutes'
        OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.bulk_batch_id=v_batch.id
          AND (t.metadata ? 'dispatched_at' OR t.status='completed')) THEN
        RETURN jsonb_build_object('found',true,'status',v_transfer.status);
      END IF;
      v_details := jsonb_build_object('reason','never_dispatched','complete_message','The payout was never sent. The full debit was returned.');
    ELSIF v_batch.dispatch_started_at IS NULL OR NOT (v_transfer.metadata ? 'dispatched_at') THEN
      RETURN jsonb_build_object('found',true,'status',v_transfer.status);
    END IF;

    IF p_status='pending' THEN
      v_details := v_details - 'flutterwave_id';
    ELSIF p_status='completed' AND (p_details->>'flutterwave_id' IS NULL OR p_details->>'flutterwave_id' !~ '^[1-9][0-9]{0,19}$') THEN
      RETURN jsonb_build_object('found',true,'status',v_transfer.status);
    END IF;
  ELSE
    IF p_status='failed' THEN
      -- A provider failure is an observation, not proof that the original debit is refundable.
      IF NOT (v_transfer.metadata->>'dispatch_guard' IS NOT DISTINCT FROM 'true'
          AND NOT (v_transfer.metadata ? 'dispatched_at') AND v_transfer.created_at IS NOT NULL
          AND v_transfer.created_at<now()-interval '2 minutes'
          AND p_details->>'reason' IS NOT DISTINCT FROM 'never_dispatched') THEN
        IF p_details->>'provider_checked'='true' AND NOT (coalesce(v_transfer.metadata,'{}') ? 'transfer_provider_failure') THEN
          UPDATE public.transactions SET metadata=coalesce(metadata,'{}') || jsonb_build_object('transfer_provider_failure',
            jsonb_build_object('observed_at',now(),'provider_id',left(p_details->>'flutterwave_id',20),
              'message',left(p_details->>'complete_message',240))),updated_at=now() WHERE id=v_transfer.id;
        ELSE
          UPDATE public.transactions SET updated_at=now() WHERE id=v_transfer.id;
        END IF;
        RETURN jsonb_build_object('found',true,'status',v_transfer.status);
      END IF;
      v_details := jsonb_build_object('reason','never_dispatched','complete_message','The payout was never sent. The full debit was returned.');
    ELSIF v_transfer.metadata->>'dispatch_guard'='true' AND NOT (v_transfer.metadata ? 'dispatched_at') THEN
      RETURN jsonb_build_object('found',true,'status',v_transfer.status);
    ELSIF p_status='pending' THEN
      v_details := v_details - 'flutterwave_id';
    ELSIF p_details->>'flutterwave_id' IS NULL OR p_details->>'flutterwave_id' !~ '^[1-9][0-9]{0,19}$' THEN
      RETURN jsonb_build_object('found',true,'status',v_transfer.status);
    END IF;
  END IF;

  v_fee := coalesce((v_transfer.metadata->>'fee')::numeric,0);
  IF p_status = 'failed' THEN
    v_refund := coalesce((v_transfer.metadata->>'total_debited')::numeric,v_transfer.amount + v_fee);
    UPDATE public.profiles SET wallet_balance = coalesce(wallet_balance,0) + v_refund, updated_at = now()
    WHERE id = v_owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer refund account not found'; END IF;
    INSERT INTO public.notifications (user_id,type,title,message,is_read)
      VALUES (v_owner,'transfer_failed','Transfer failed and refunded',format('₦%s was returned to your wallet.',v_refund),false);
  ELSIF p_status = 'completed' AND v_fee > 0 AND v_transfer.metadata ? 'pricing_reserved' THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount)
      VALUES (v_transfer.id,'bank_transfer',v_fee) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.transactions SET status = p_status,
    metadata = coalesce(metadata,'{}'::jsonb) || v_details,
    updated_at = now() WHERE id = v_transfer.id;
  RETURN jsonb_build_object('found',true,'status',p_status);
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
