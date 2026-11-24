BEGIN;

CREATE TABLE public.wallet_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference text NOT NULL UNIQUE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id),
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 8 AND 400),
  submitted_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  transaction_id uuid UNIQUE REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (submitted_by <> target_user_id),
  CHECK (reviewed_by IS NULL OR reviewed_by NOT IN (submitted_by,target_user_id)),
  CHECK ((status='approved') = (transaction_id IS NOT NULL)),
  CHECK ((status='pending') = (reviewed_by IS NULL AND reviewed_at IS NULL))
);
CREATE INDEX wallet_adjustment_review_queue ON public.wallet_adjustment_requests(status,created_at DESC);
ALTER TABLE public.wallet_adjustment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_adjustment_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.wallet_adjustment_requests TO authenticated;
CREATE POLICY "Active admins can read wallet adjustment requests" ON public.wallet_adjustment_requests
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE FUNCTION public.admin_request_wallet_adjustment(p_user_id uuid,p_amount numeric,p_direction text,
  p_reason text,p_case_reference text,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid:=auth.uid();
  v_case text:=upper(btrim(coalesce(p_case_reference,'')));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_request public.wallet_adjustment_requests%ROWTYPE;
  v_pin json;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF p_user_id IS NULL OR p_user_id=v_admin THEN RAISE EXCEPTION 'An independent administrator must submit this request.'; END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('credit','debit')
    OR p_amount IS NULL OR p_amount NOT BETWEEN 0.01 AND 9999999999999.99
    OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Enter a valid naira amount and direction.'; END IF;
  IF v_case !~ '^[A-Z0-9][A-Z0-9._-]{5,79}$' OR length(v_reason) NOT BETWEEN 8 AND 400 THEN
    RAISE EXCEPTION 'Enter a unique case reference and an audit reason.';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (v_admin,p_user_id) ORDER BY id FOR NO KEY UPDATE;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Wallet unavailable.'; END IF;
  v_pin:=public.check_wallet_pin(v_admin,p_pin);
  IF v_pin->>'success' IS DISTINCT FROM 'true' THEN RETURN v_pin::jsonb; END IF;

  INSERT INTO public.wallet_adjustment_requests(case_reference,target_user_id,direction,amount,reason,submitted_by)
    VALUES(v_case,p_user_id,p_direction,p_amount,v_reason,v_admin)
    ON CONFLICT(case_reference) DO NOTHING RETURNING * INTO v_request;
  IF FOUND THEN
    INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
      VALUES(v_admin,'wallet_adjustment_requested','user',p_user_id::text,'Requested a wallet adjustment.',
        jsonb_build_object('request_id',v_request.id,'case_reference',v_case,'amount',p_amount,'direction',p_direction));
  ELSE
    SELECT * INTO v_request FROM public.wallet_adjustment_requests WHERE case_reference=v_case;
    IF v_request.submitted_by IS DISTINCT FROM v_admin OR v_request.target_user_id IS DISTINCT FROM p_user_id
      OR v_request.direction IS DISTINCT FROM p_direction OR v_request.amount IS DISTINCT FROM p_amount
      OR v_request.reason IS DISTINCT FROM v_reason THEN
      RAISE EXCEPTION 'This case reference already belongs to another adjustment.';
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'id',v_request.id,'status',v_request.status);
END;
$$;

CREATE FUNCTION public.admin_decide_wallet_adjustment(p_request_id uuid,p_approve boolean,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid:=auth.uid();
  v_request public.wallet_adjustment_requests%ROWTYPE;
  v_pin json;
  v_before numeric;
  v_after numeric;
  v_tx uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Choose a review decision.'; END IF;
  SELECT * INTO v_request FROM public.wallet_adjustment_requests WHERE id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment request unavailable.'; END IF;
  IF v_admin IN (v_request.submitted_by,v_request.target_user_id) THEN
    RAISE EXCEPTION 'A different administrator must review this request.';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (v_admin,v_request.submitted_by,v_request.target_user_id)
    ORDER BY id FOR NO KEY UPDATE;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  v_pin:=public.check_wallet_pin(v_admin,p_pin);
  IF v_pin->>'success' IS DISTINCT FROM 'true' THEN RETURN v_pin::jsonb; END IF;

  SELECT * INTO v_request FROM public.wallet_adjustment_requests WHERE id=p_request_id FOR UPDATE;
  IF v_request.status<>'pending' THEN
    RETURN jsonb_build_object('success',true,'status',v_request.status,'transaction_id',v_request.transaction_id);
  END IF;
  IF p_approve THEN
    IF NOT EXISTS (SELECT FROM public.profiles WHERE id=v_request.submitted_by AND role='admin' AND coalesce(status,'active')='active') THEN
      RAISE EXCEPTION 'The requesting administrator is no longer active. Reject this request and open a new case.';
    END IF;
    SELECT coalesce(wallet_balance,0) INTO v_before FROM public.profiles WHERE id=v_request.target_user_id;
    v_after:=v_before + CASE WHEN v_request.direction='credit' THEN v_request.amount ELSE -v_request.amount END;
    IF v_after<0 THEN RETURN jsonb_build_object('success',false,'error','This wallet no longer has enough available funds.'); END IF;
    UPDATE public.profiles SET wallet_balance=v_after,updated_at=now() WHERE id=v_request.target_user_id;
    INSERT INTO public.transactions(user_id,type,amount,description,status,payment_method,reference_id,balance_before,balance_after,metadata)
      VALUES(v_request.target_user_id,CASE WHEN v_request.direction='credit' THEN 'deposit' ELSE 'payment' END,
        v_request.amount,v_request.reason,'completed',CASE WHEN v_request.direction='credit' THEN 'admin' ELSE 'admin_debit' END,
        'ADMIN_ADJUSTMENT_'||v_request.id,v_before,v_after,
        jsonb_build_object('adjustment_id',v_request.id,'case_reference',v_request.case_reference,
          'submitted_by',v_request.submitted_by,'approved_by',v_admin))
      RETURNING id INTO v_tx;
    INSERT INTO public.notifications(user_id,type,title,message)
      VALUES(v_request.target_user_id,CASE WHEN v_request.direction='credit' THEN 'deposit' ELSE 'withdrawal' END,
        'Wallet adjustment',format('A ₦%s wallet %s was approved.',v_request.amount,v_request.direction));
  END IF;
  UPDATE public.wallet_adjustment_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by=v_admin,reviewed_at=now(),transaction_id=v_tx WHERE id=p_request_id
    RETURNING * INTO v_request;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
    VALUES(v_admin,'wallet_adjustment_'||v_request.status,'user',v_request.target_user_id::text,
      'Recorded an independent wallet adjustment decision.',
      jsonb_build_object('request_id',v_request.id,'case_reference',v_request.case_reference,'transaction_id',v_tx,
        'amount',v_request.amount,'direction',v_request.direction,'balance_before',v_before,'balance_after',v_after));
  RETURN jsonb_build_object('success',true,'status',v_request.status,'transaction_id',v_tx);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_request_wallet_adjustment(uuid,numeric,text,text,text,text),
  public.admin_decide_wallet_adjustment(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_wallet_adjustment(uuid,numeric,text,text,text,text),
  public.admin_decide_wallet_adjustment(uuid,boolean,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_wallet(uuid,numeric,text,text),
  public.admin_deposit_to_user(uuid,numeric,text) FROM PUBLIC,anon,authenticated,service_role;

-- Penalty records can still be opened and waived. Every wallet movement uses the approval queue.
ALTER FUNCTION public.admin_issue_penalty(uuid,numeric,text,text,boolean,uuid,uuid) RENAME TO internal_admin_issue_penalty;
ALTER FUNCTION public.admin_waive_penalty(uuid,boolean,text) RENAME TO internal_admin_waive_penalty;
REVOKE EXECUTE ON FUNCTION public.internal_admin_issue_penalty(uuid,numeric,text,text,boolean,uuid,uuid),
  public.internal_admin_waive_penalty(uuid,boolean,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_issue_penalty(p_user_id uuid,p_amount numeric,p_penalty_type text,
  p_reason text,p_deduct_wallet boolean DEFAULT false,p_group_id uuid DEFAULT NULL,p_aml_alert_id uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF p_deduct_wallet IS DISTINCT FROM false THEN
    RETURN json_build_object('success',false,'error','Submit a wallet debit in Wallet adjustments for independent approval.');
  END IF;
  RETURN public.internal_admin_issue_penalty(p_user_id,p_amount,p_penalty_type,p_reason,false,p_group_id,p_aml_alert_id);
END;
$$;

CREATE FUNCTION public.admin_waive_penalty(p_penalty_id uuid,p_refund_wallet boolean DEFAULT false,p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF p_refund_wallet IS DISTINCT FROM false THEN
    RETURN json_build_object('success',false,'error','Submit a wallet credit in Wallet adjustments for independent approval.');
  END IF;
  RETURN public.internal_admin_waive_penalty(p_penalty_id,false,p_note);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_penalty(uuid,numeric,text,text,boolean,uuid,uuid),
  public.admin_waive_penalty(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_penalty(uuid,numeric,text,text,boolean,uuid,uuid),
  public.admin_waive_penalty(uuid,boolean,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
