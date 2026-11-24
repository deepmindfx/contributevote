BEGIN;

CREATE TABLE public.payout_recovery_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  basis text NOT NULL CHECK (basis IN ('not_debited','reversed')),
  evidence_reference text NOT NULL,
  evidence_note text NOT NULL,
  provider_status text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','cancelled')),
  credit_transaction_id uuid UNIQUE REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK (status<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_by<>submitted_by AND credit_transaction_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_open_or_paid_payout_recovery ON public.payout_recovery_reviews(transaction_id) WHERE status IN ('pending','approved');
CREATE UNIQUE INDEX payout_recovery_evidence_once ON public.payout_recovery_reviews(lower(evidence_reference)) WHERE status IN ('pending','approved');
ALTER TABLE public.payout_recovery_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payout_recovery_reviews FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.admin_list_payout_recoveries()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.created_at DESC) FROM (
      SELECT r.id,t.reference_id,t.amount,t.status AS transfer_status,
        (t.bulk_batch_id IS NOT NULL) AS bulk,r.basis,r.evidence_reference,r.evidence_note,
        r.status,r.submitted_by,r.reviewed_by,r.created_at
      FROM public.payout_recovery_reviews r JOIN public.transactions t ON t.id=r.transaction_id
      ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 50
    ) recent
  ),'[]'::jsonb);
END;
$$;

CREATE FUNCTION public.admin_request_payout_recovery(p_reference text,p_basis text,p_evidence_reference text,p_evidence_note text,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_transfer public.transactions%ROWTYPE;
  v_id uuid;
  v_pin json;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  IF p_basis IS NULL OR p_basis NOT IN ('not_debited','reversed') OR
    length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 5 AND 150 OR
    length(btrim(coalesce(p_evidence_note,''))) NOT BETWEEN 20 AND 1000 THEN
    RAISE EXCEPTION 'Enter the provider settlement reference and the evidence you verified.';
  END IF;
  v_pin:=public.check_wallet_pin(v_admin,p_pin);
  IF v_pin->>'success' IS DISTINCT FROM 'true' THEN RETURN v_pin::jsonb; END IF;

  SELECT * INTO v_transfer FROM public.transactions
    WHERE reference_id=btrim(p_reference) AND type='transfer' AND user_id IS NOT NULL
      AND user_id<>v_admin AND status='pending' AND metadata->>'pricing_reserved'='true'
      AND metadata ? 'dispatched_at' AND created_at<=now()-interval '15 minutes' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only dispatched payouts pending for at least 15 minutes can enter review.'; END IF;

  INSERT INTO public.payout_recovery_reviews(transaction_id,submitted_by,basis,evidence_reference,evidence_note)
    VALUES(v_transfer.id,v_admin,p_basis,btrim(p_evidence_reference),btrim(p_evidence_note))
    RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
    VALUES(v_admin,'payout_recovery_requested','transaction',v_transfer.id::text,
      'Submitted provider settlement evidence for independent payout review.',
      jsonb_build_object('review_id',v_id,'basis',p_basis,'evidence_reference',btrim(p_evidence_reference)));
  RETURN jsonb_build_object('id',v_id);
END;
$$;

CREATE FUNCTION public.service_decide_payout_recovery(p_admin_id uuid,p_review_id uuid,p_approve boolean,p_pin text,p_provider_status text)
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
    IF p_provider_status IS NULL OR (p_provider_status NOT IN ('FAILED','CANCELLED','CANCELED','REVERSED')
       AND NOT (p_provider_status='NOT_FOUND' AND v_review.basis='not_debited')) THEN
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
REVOKE ALL ON FUNCTION public.admin_list_payout_recoveries(),public.admin_request_payout_recovery(text,text,text,text,text),
  public.service_decide_payout_recovery(uuid,uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payout_recoveries(),public.admin_request_payout_recovery(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_decide_payout_recovery(uuid,uuid,boolean,text,text) TO service_role;
GRANT SELECT ON public.payout_recovery_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_statement_export(p_month date,p_scope text,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz;
  v_end timestamptz;
  v_profile public.profiles%ROWTYPE;
  v_account jsonb;
  v_pin json;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to export a statement' USING ERRCODE='42501'; END IF;
  IF p_month IS NULL OR NOT isfinite(p_month) OR extract(day FROM p_month)<>1 OR
    p_month>date_trunc('month',now() AT TIME ZONE 'Africa/Lagos')::date OR
    p_scope IS NULL OR p_scope NOT IN ('wallet','bulk') THEN
    RETURN jsonb_build_object('error','Choose a valid statement month.');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Your wallet could not be found.'); END IF;
  v_pin := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin::jsonb; END IF;

  v_start := p_month::timestamp AT TIME ZONE 'Africa/Lagos';
  v_end := (p_month + interval '1 month') AT TIME ZONE 'Africa/Lagos';
  v_account := coalesce(v_profile.preferences->'virtualAccount','{}'::jsonb);
  IF coalesce(nullif(v_account->>'accountNumber',''),v_account->>'account_number','') !~ '^[0-9]{10}$' THEN
    SELECT jsonb_build_object(
      'accountNumber',coalesce(nullif(item->>'accountNumber',''),item->>'account_number'),
      'bankName',coalesce(nullif(item->>'bankName',''),nullif(item->>'bank_name',''),nullif(v_account->>'bankName',''),v_account->>'bank_name'),
      'accountName',coalesce(nullif(item->>'accountName',''),nullif(item->>'account_name',''),nullif(v_account->>'accountName',''),v_account->>'account_name')
    ) INTO v_account FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_account->'accounts')='array' THEN v_account->'accounts' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS linked(item,ordinal)
    WHERE coalesce(nullif(item->>'accountNumber',''),item->>'account_number','') ~ '^[0-9]{10}$' ORDER BY ordinal LIMIT 1;
  END IF;

  IF p_scope='bulk' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'authorized_at',b.authorized_at,'batch_name',b.title,'reference',t.reference_id,'status',t.status,
      'recipient_name',t.metadata->>'beneficiary_name','account_number',t.metadata->>'account_number',
      'bank_code',t.metadata->>'account_bank','bank_name',t.metadata->>'bank_name',
      'amount',t.amount,'fee',coalesce((t.metadata->>'fee')::numeric,0),'vat',coalesce((t.metadata->>'vat')::numeric,0),
      'total',coalesce((t.metadata->>'total_debited')::numeric,t.amount)
    ) ORDER BY b.authorized_at,b.id,coalesce((t.metadata->>'row_number')::integer,0),t.id),'[]'::jsonb)
    INTO v_rows
    FROM public.bulk_transfer_batches b JOIN public.transactions t ON t.bulk_batch_id=b.id AND t.user_id=v_uid
    WHERE b.user_id=v_uid AND b.authorized_at>=v_start AND b.authorized_at<v_end;
  ELSE
    SELECT coalesce(jsonb_agg(
      to_jsonb(t)-'metadata' || jsonb_build_object('metadata',jsonb_build_object('fee',t.metadata->'fee','total_debited',t.metadata->'total_debited','payout_recovery_id',t.metadata->'payout_recovery_id'))
      ORDER BY t.created_at,t.id),'[]'::jsonb) INTO v_rows
    FROM public.transactions t WHERE t.user_id=v_uid AND t.created_at>=v_start AND t.created_at<v_end;
  END IF;

  RETURN jsonb_build_object('success',true,'holder',coalesce(nullif(v_account->>'accountName',''),nullif(v_account->>'account_name',''),v_profile.name),'generated_at',statement_timestamp(),
    'account_number',coalesce(nullif(v_account->>'accountNumber',''),v_account->>'account_number'),
    'bank_name',coalesce(nullif(v_account->>'bankName',''),v_account->>'bank_name'),
    'entries',v_rows);
END;
$$;

CREATE FUNCTION public.service_flag_payout_recovery_conflict(p_reference text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.aml_alerts(alert_key,user_id,transaction_id,alert_type,severity,status,risk_score,amount,title,description)
  SELECT 'payout_recovery_conflict:'||t.id,t.user_id,t.id,'external_payment_risk','critical','open',99,t.amount,
    'Provider status changed after payout recovery',
    'Flutterwave reported success for a payout restored through independent settlement review.'
  FROM public.transactions t JOIN public.payout_recovery_reviews r ON r.transaction_id=t.id AND r.status='approved'
  WHERE t.reference_id=p_reference AND t.type='transfer' AND t.status='failed'
  ON CONFLICT(alert_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.service_flag_payout_recovery_conflict(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_flag_payout_recovery_conflict(text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
