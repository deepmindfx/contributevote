BEGIN;

CREATE FUNCTION public.service_authorize_bulk_transfer(p_user_id uuid, p_batch_id uuid, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_settings public.bulk_transfer_settings%ROWTYPE;
  v_batch public.bulk_transfer_batches%ROWTYPE;
  v_balance numeric;
  v_start timestamptz := (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos');
  v_daily numeric;
  v_total numeric;
  v_row record;
  v_debit numeric;
  v_pin json;
BEGIN
  SELECT coalesce(wallet_balance,0) INTO v_balance FROM public.profiles
    WHERE id=p_user_id AND coalesce(status,'active')='active' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success',false,'error','An active account with a confirmed email is required');
  END IF;
  SELECT * INTO v_batch FROM public.bulk_transfer_batches WHERE id=p_batch_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Batch not found'); END IF;
  IF v_batch.authorized_at IS NOT NULL THEN RETURN jsonb_build_object('success',true); END IF;

  SELECT * INTO STRICT v_settings FROM public.bulk_transfer_settings FOR SHARE;
  IF NOT v_settings.enabled THEN RETURN jsonb_build_object('success',false,'error','Bulk transfers are paused'); END IF;
  IF v_batch.expires_at<=now() OR v_batch.pricing_revision IS DISTINCT FROM v_settings.revision THEN
    RETURN jsonb_build_object('success',false,'error','This quote expired or pricing changed. Review a new quote before sending.');
  END IF;
  v_pin := public.check_wallet_pin(p_user_id,p_pin);
  IF (v_pin->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin::jsonb; END IF;

  SELECT coalesce(sum(amount),0) INTO v_daily FROM public.transactions
    WHERE user_id=p_user_id AND bulk_batch_id IS NOT NULL AND status IN ('pending','completed')
      AND created_at>=v_start AND created_at<v_start + interval '24 hours';
  IF v_daily + v_batch.principal > v_settings.daily_amount_limit THEN
    RETURN jsonb_build_object('success',false,'error','This batch exceeds your daily bulk transfer limit');
  END IF;
  v_total := v_batch.principal + v_batch.fee + v_batch.vat;
  IF v_balance < v_total THEN RETURN jsonb_build_object('success',false,'error','Insufficient wallet balance for this batch'); END IF;

  UPDATE public.profiles SET wallet_balance=v_balance-v_total,updated_at=now() WHERE id=p_user_id;
  FOR v_row IN SELECT * FROM jsonb_to_recordset(v_batch.recipients) AS r(row_number integer, account_bank text,
      account_number text, beneficiary_name text, amount numeric, fee numeric, vat numeric, narration text, reference text)
      ORDER BY row_number LOOP
    v_debit := v_row.amount+v_row.fee+v_row.vat;
    INSERT INTO public.transactions (user_id,bulk_batch_id,type,amount,status,payment_method,reference_id,description,balance_before,balance_after,metadata)
    VALUES(p_user_id,p_batch_id,'transfer',v_row.amount,'pending','bulk_bank_transfer',v_row.reference,'Bulk transfer to ' || v_row.beneficiary_name,
      v_balance,v_balance-v_debit,jsonb_build_object('row_number',v_row.row_number,'pricing_reserved',true,'dispatch_guard',true,
      'total_debited',v_debit,'fee',v_row.fee,'vat',v_row.vat,'vat_percent',v_batch.vat_percent,'fee_reason','bulk',
      'account_bank',v_row.account_bank,'account_number',v_row.account_number,'beneficiary_name',v_row.beneficiary_name,'narration',v_row.narration));
    v_balance := v_balance-v_debit;
  END LOOP;
  UPDATE public.bulk_transfer_batches SET authorized_at=now() WHERE id=p_batch_id;
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE FUNCTION public.service_claim_bulk_transfer(p_user_id uuid,p_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_batch public.bulk_transfer_batches%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=p_user_id AND coalesce(status,'active')='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_batch FROM public.bulk_transfer_batches WHERE id=p_batch_id AND user_id=p_user_id
    AND authorized_at IS NOT NULL AND dispatch_started_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.bulk_transfer_settings WHERE singleton AND enabled FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM public.transactions WHERE bulk_batch_id=p_batch_id AND status='pending'
      AND NOT (metadata ? 'dispatched_at')) <> v_batch.recipient_count THEN RETURN NULL; END IF;

  UPDATE public.transactions SET metadata=metadata || jsonb_build_object('dispatched_at',now()),updated_at=now() WHERE bulk_batch_id=p_batch_id;
  UPDATE public.bulk_transfer_batches SET dispatch_started_at=now() WHERE id=p_batch_id;
  RETURN v_batch.recipients;
END;
$$;

CREATE FUNCTION public.service_set_bulk_provider_id(p_batch_id uuid,p_provider_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH recorded AS (
    UPDATE public.bulk_transfer_batches SET provider_batch_id=p_provider_id
    WHERE id=p_batch_id AND dispatch_started_at IS NOT NULL AND p_provider_id ~ '^[1-9][0-9]{0,19}$'
      AND (provider_batch_id IS NULL OR provider_batch_id=p_provider_id)
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM recorded);
$$;

REVOKE ALL ON FUNCTION public.service_authorize_bulk_transfer(uuid,uuid,text),public.service_claim_bulk_transfer(uuid,uuid),public.service_set_bulk_provider_id(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.service_authorize_bulk_transfer(uuid,uuid,text),public.service_claim_bulk_transfer(uuid,uuid),public.service_set_bulk_provider_id(uuid,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
