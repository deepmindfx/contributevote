BEGIN;

CREATE FUNCTION public.prepare_statement_export(p_month date,p_scope text,p_pin text)
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
      to_jsonb(t)-'metadata' || jsonb_build_object('metadata',jsonb_build_object('fee',t.metadata->'fee','total_debited',t.metadata->'total_debited'))
      ORDER BY t.created_at,t.id),'[]'::jsonb) INTO v_rows
    FROM public.transactions t WHERE t.user_id=v_uid AND t.created_at>=v_start AND t.created_at<v_end;
  END IF;

  RETURN jsonb_build_object('success',true,'holder',coalesce(nullif(v_account->>'accountName',''),nullif(v_account->>'account_name',''),v_profile.name),'generated_at',statement_timestamp(),
    'account_number',coalesce(nullif(v_account->>'accountNumber',''),v_account->>'account_number'),
    'bank_name',coalesce(nullif(v_account->>'bankName',''),v_account->>'bank_name'),
    'entries',v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_statement_export(date,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_statement_export(date,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
