BEGIN;

ALTER TABLE public.group_refund_requests ADD COLUMN verified_request boolean NOT NULL DEFAULT false;

-- Earlier refund votes were client-writable. Close unsettled proposals and retain their
-- history so organizers can open a fresh vote without paying on unverified approval.
UPDATE public.group_refund_requests SET status='rejected',updated_at=now(),
  execution_details=coalesce(execution_details,'{}') || '{"reason":"new_vote_required"}'
WHERE status IN ('pending','approved');
-- Protected refund requests and an atomic settlement for all registered contributors.
CREATE FUNCTION public.create_group_refund_request(p_group_id uuid, p_reason text, p_refund_type text, p_percent numeric, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group public.contribution_groups%ROWTYPE;
  v_pin json;
  v_voters integer;
  v_request public.group_refund_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','Sign in to request a refund.'); END IF;
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 1000 OR p_refund_type IS NULL
    OR p_refund_type NOT IN ('full','partial') OR (p_refund_type = 'partial' AND
      (p_percent IS NULL OR p_percent NOT BETWEEN 1 AND 100 OR p_percent <> round(p_percent,2))) THEN
    RETURN jsonb_build_object('error','Enter a reason and a valid refund percentage.');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_uid AND coalesce(status,'active') = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','An active wallet is required.'); END IF;
  v_pin := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin::jsonb; END IF;

  SELECT * INTO v_group FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND OR v_group.creator_id IS DISTINCT FROM v_uid OR coalesce(v_group.status,'active') <> 'active'
     OR coalesce(v_group.current_amount,0) <= 0 THEN
    RETURN jsonb_build_object('error','An active group with a remaining balance is required.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.group_refund_requests WHERE group_id = p_group_id
    AND (status = 'approved' OR (status = 'pending' AND voting_deadline > now()))) THEN
    RETURN jsonb_build_object('error','This group already has a refund in progress.');
  END IF;
  SELECT count(DISTINCT user_id) INTO v_voters FROM public.contributors
    WHERE group_id = p_group_id AND has_voting_rights AND user_id IS NOT NULL;
  IF v_voters = 0 THEN RETURN jsonb_build_object('error','This group needs contributors with voting rights to open a refund vote.'); END IF;

  INSERT INTO public.group_refund_requests
    (group_id,requester_id,reason,refund_type,partial_percentage,status,voting_deadline,votes,total_votes_for,total_votes_against,total_eligible_voters,verified_request)
  VALUES (p_group_id,v_uid,trim(p_reason),p_refund_type,CASE WHEN p_refund_type='partial' THEN p_percent END,
    'pending',now()+interval '7 days','[]',0,0,v_voters,true) RETURNING * INTO v_request;
  INSERT INTO public.notifications(user_id,type,title,message,related_id)
  SELECT DISTINCT user_id,'refund_request','Group refund vote opened','Vote on the refund for ' || v_group.name || '.',p_group_id
    FROM public.contributors WHERE group_id = p_group_id AND has_voting_rights AND user_id IS NOT NULL;
  RETURN jsonb_build_object('request',to_jsonb(v_request));
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.group_refund_requests FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.withdrawal_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_group_refund_request(uuid,text,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_refund_request(uuid,text,text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_group_refund(p_refund_request_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_request public.group_refund_requests%ROWTYPE;
  v_group public.contribution_groups%ROWTYPE;
  v_share record;
  v_total_cents numeric;
  v_payable_cents numeric;
  v_scale numeric;
  v_percent numeric;
  v_paid numeric := 0;
  v_count integer := 0;
  v_amount numeric;
  v_balance numeric;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_request FROM public.group_refund_requests WHERE id = p_refund_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Refund request not found.'); END IF;
  IF v_request.status = 'executed' THEN RETURN json_build_object('success',true,'already_executed',true); END IF;
  IF v_request.status <> 'approved' OR NOT v_request.verified_request THEN
    RETURN json_build_object('success',false,'error','Refund must be approved through a verified vote first.');
  END IF;

  -- Match the profile-then-group lock order used when moving funds into or out of a group.
  PERFORM 1 FROM public.profiles p WHERE p.id IN (
    SELECT c.user_id FROM public.contributors c WHERE c.group_id = v_request.group_id AND c.total_contributed > 0
  ) ORDER BY p.id FOR UPDATE;
  SELECT * INTO v_group FROM public.contribution_groups WHERE id = v_request.group_id FOR UPDATE;
  IF NOT FOUND OR coalesce(v_group.status,'active') = 'frozen' THEN
    RETURN json_build_object('success',false,'error','Group refunds are temporarily unavailable.');
  END IF;

  IF EXISTS (
    SELECT FROM public.contributors c LEFT JOIN public.profiles p ON p.id = c.user_id
    WHERE c.group_id = v_group.id AND c.total_contributed > 0 AND (c.user_id IS NULL OR p.id IS NULL)
  ) THEN RETURN json_build_object('success',false,'error','Link all paid contributions to registered wallets before settling this refund.'); END IF;

  v_percent := CASE WHEN v_request.refund_type = 'full' THEN 100 ELSE v_request.partial_percentage END;
  IF v_percent IS NULL OR v_percent NOT BETWEEN 1 AND 100 THEN
    RETURN json_build_object('success',false,'error','Refund percentage is invalid.');
  END IF;
  SELECT coalesce(sum(round(total_contributed*100)),0) INTO v_total_cents
    FROM public.contributors WHERE group_id = v_group.id AND total_contributed > 0;
  v_payable_cents := least(greatest(floor(coalesce(v_group.current_amount,0)*100),0),round(v_total_cents*v_percent/100));
  IF v_payable_cents <= 0 THEN RETURN json_build_object('success',false,'error','There is no remaining balance to refund.'); END IF;
  v_scale := v_payable_cents / v_total_cents;

  -- Allocate each kobo exactly once. Equal remainders are resolved in a stable order.
  FOR v_share IN
    WITH eligible AS (
      SELECT id,user_id,total_contributed,round(total_contributed*100)*v_scale AS exact
      FROM public.contributors WHERE group_id = v_group.id AND total_contributed > 0
    ), ranked AS (
      SELECT *,floor(exact) AS base,sum(floor(exact)) OVER () AS total_base,
        row_number() OVER (ORDER BY exact-floor(exact) DESC,user_id,id) AS rank FROM eligible
    )
    SELECT *,base + CASE WHEN rank <= v_payable_cents-total_base THEN 1 ELSE 0 END AS cents
    FROM ranked ORDER BY user_id,id
  LOOP
    v_amount := v_share.cents / 100;
    IF v_amount <= 0 THEN CONTINUE; END IF;
    UPDATE public.profiles SET wallet_balance=coalesce(wallet_balance,0)+v_amount,updated_at=now()
      WHERE id=v_share.user_id RETURNING wallet_balance INTO STRICT v_balance;
    UPDATE public.contributors SET total_contributed=greatest(total_contributed-v_amount,0),updated_at=now() WHERE id=v_share.id;

    INSERT INTO public.transactions (user_id,contribution_id,type,amount,description,status,payment_method,
      reference_id,balance_before,balance_after,metadata)
    VALUES (v_share.user_id,v_group.id,'refund',v_amount,'Group refund from ' || v_group.name,'completed','wallet',
      'REFUND_' || v_request.id || '_' || v_share.user_id,v_balance-v_amount,v_balance,
      jsonb_build_object('refund_request_id',v_request.id,'original_contribution',v_share.total_contributed,'refund_percentage',v_percent))
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.refund_transactions(refund_request_id,user_id,group_id,original_contribution,
      refund_amount,refund_percentage,status,transaction_id,completed_at)
    VALUES (v_request.id,v_share.user_id,v_group.id,v_share.total_contributed,v_amount,v_percent,'completed',v_transaction_id,now());
    INSERT INTO public.notifications(user_id,type,title,message,related_id)
    VALUES (v_share.user_id,'refund_completed','Group refund received',format('₦%s returned to your wallet.',v_amount),v_group.id);
    v_paid := v_paid + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF v_paid*100 <> v_payable_cents THEN RAISE EXCEPTION 'Refund allocation does not match the group debit'; END IF;
  UPDATE public.contribution_groups SET current_amount=current_amount-v_paid,updated_at=now() WHERE id=v_group.id;
  UPDATE public.group_refund_requests SET status='executed',executed_at=now(),updated_at=now(),
    execution_details=jsonb_build_object('total_refunded',v_paid,'refunds_processed',v_count,'refunds_failed',0)
    WHERE id=v_request.id;
  RETURN json_build_object('success',true,'total_refunded',v_paid,'refunds_processed',v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.process_group_refund(uuid), public.cast_refund_vote(uuid,text),
  public.cast_withdrawal_vote(uuid,boolean), public.process_approved_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_group_refund(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_approved_withdrawal(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_refund_vote(uuid,text), public.cast_withdrawal_vote(uuid,boolean) TO authenticated;

CREATE FUNCTION public.retry_group_refund(p_refund_request_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM public.group_refund_requests r JOIN public.contribution_groups g ON g.id=r.group_id
    WHERE r.id=p_refund_request_id AND g.creator_id=auth.uid() AND r.status IN ('approved','executed')
  ) THEN RETURN json_build_object('success',false,'error','This refund cannot be retried.'); END IF;
  RETURN public.process_group_refund(p_refund_request_id);
END;
$$;
REVOKE ALL ON FUNCTION public.retry_group_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_group_refund(uuid) TO authenticated;

COMMIT;
