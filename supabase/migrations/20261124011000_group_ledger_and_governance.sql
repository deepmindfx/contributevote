BEGIN;

CREATE FUNCTION public.get_group_contribution_history(p_group_id uuid,p_contributor_id uuid)
RETURNS TABLE(id uuid,amount numeric,created_at timestamptz,description text,payment_method text,
  reference_id text,status text,voting_rights_granted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contributor public.contributors%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  SELECT c.* INTO v_contributor FROM public.contributors c WHERE c.id=p_contributor_id AND c.group_id=p_group_id;
  IF NOT FOUND OR (
    v_contributor.user_id IS DISTINCT FROM v_user
    AND NOT public.can_manage_group_roster(p_group_id)
    AND NOT EXISTS (SELECT FROM public.contributors c WHERE c.group_id=p_group_id AND c.user_id=v_user)
  ) THEN RETURN; END IF;

  IF v_contributor.user_id IS NULL AND v_contributor.join_method='bank_transfer' THEN
    RETURN QUERY SELECT v_contributor.id,v_contributor.total_contributed,
      coalesce(v_contributor.last_contribution_at,v_contributor.joined_at),
      'Outside bank contribution'::text,'bank_transfer'::text,
      'GROUP-' || upper(left(md5(v_contributor.id::text),12)),
      'completed'::text,false;
    RETURN;
  END IF;

  RETURN QUERY SELECT t.id,t.amount,t.created_at,
    CASE WHEN t.user_id=v_user THEN coalesce(t.description,'Group contribution') ELSE 'Group contribution' END,
    coalesce(t.payment_method,'wallet')::text,
    CASE WHEN t.user_id=v_user AND t.reference_id IS NOT NULL THEN t.reference_id
         ELSE 'GROUP-' || upper(left(md5(t.id::text),12)) END,
    t.status::text,
    coalesce(t.metadata->>'votingRightsGranted',CASE WHEN t.payment_method='wallet' THEN 'true' ELSE 'false' END)='true'
  FROM public.transactions t
  WHERE t.user_id=v_contributor.user_id AND t.contribution_id=p_group_id
    AND t.type IN ('contribution','deposit') AND t.status IN ('completed','successful')
    AND (t.user_id=v_user OR (NOT coalesce(v_contributor.anonymous,false) AND NOT coalesce(t.anonymous,false)))
  ORDER BY t.created_at DESC,t.id DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_group_contribution_history(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_contribution_history(uuid,uuid) TO authenticated;

-- Legacy requests with no authenticated server creation record need a fresh vote.
-- Preserve the old vote and decision in the system audit log. Never adjust either balance here.
WITH candidates AS (
  SELECT w.*, EXISTS (
    SELECT FROM public.transactions t WHERE t.contribution_id=w.contribution_id AND t.user_id=w.requester_id
      AND t.type='withdrawal' AND t.status='completed'
      AND (t.reference_id='WITHDRAWAL_' || w.id::text OR t.metadata->>'withdrawal_id'=w.id::text)
  ) AS settled FROM public.withdrawal_requests w
  WHERE w.status IN ('pending','approved') AND NOT (
    (w.status='pending' OR w.verified_approval) AND EXISTS (
      SELECT FROM public.group_withdrawal_attempts a
      WHERE a.user_id=w.requester_id AND a.group_id=w.contribution_id AND NOT a.instant AND a.result->>'id'=w.id::text
    )
  ) FOR UPDATE
), closed AS (
  UPDATE public.withdrawal_requests w SET status=CASE WHEN c.settled THEN 'executed' ELSE 'rejected' END,
    verified_approval=false,updated_at=now()
  FROM candidates c WHERE w.id=c.id
  RETURNING c.id,c.contribution_id,c.requester_id,c.status,c.amount,c.votes,c.settled
), recorded AS (
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary,metadata)
  SELECT NULL,'legacy_withdrawal_closed','group',contribution_id,
    CASE WHEN settled THEN 'Matched existing wallet settlement.' ELSE 'Closed an unverified legacy proposal.' END,
    jsonb_build_object('withdrawal_id',id,'previous_status',status,'amount',amount,'votes',votes,'existing_settlement',settled)
  FROM closed RETURNING target_id
)
INSERT INTO public.notifications(user_id,type,title,message,related_id)
  SELECT requester_id,'withdrawal_rejected','Group withdrawal vote closed',
    'This older approval could not be verified. You can open a new withdrawal vote. No funds moved.',id
  FROM closed WHERE requester_id IS NOT NULL AND NOT settled;

CREATE OR REPLACE FUNCTION public.process_approved_withdrawal(p_withdrawal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_withdrawal record;
  v_group record;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF v_withdrawal.status = 'executed' THEN
    RETURN json_build_object('success', true, 'status', 'executed', 'message', 'Withdrawal already executed');
  END IF;

  IF v_withdrawal.status <> 'approved' OR NOT v_withdrawal.verified_approval THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not approved');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_admin_balance_before
  FROM public.profiles
  WHERE id = v_withdrawal.requester_id AND coalesce(status,'active')='active'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Withdrawal recipient is unavailable pending account review'); END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;

  IF v_group IS NULL OR v_group.creator_id IS DISTINCT FROM v_withdrawal.requester_id THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal requester is no longer the group owner');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Group is not active; payout blocked pending compliance review');
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < v_withdrawal.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient group balance');
  END IF;

  v_fee := v_withdrawal.fee_amount;
  v_net := v_withdrawal.amount - v_fee;
  v_admin_balance_after := v_admin_balance_before + v_net;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - v_withdrawal.amount,
      updated_at = now()
  WHERE id = v_withdrawal.contribution_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = v_withdrawal.requester_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    v_withdrawal.requester_id, v_withdrawal.contribution_id, 'withdrawal',
    v_net, 'Withdrawal approved: ' || v_withdrawal.purpose,
    'completed', 'wallet', 'WITHDRAWAL_' || p_withdrawal_id::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'group_id', v_withdrawal.contribution_id,
      'purpose', v_withdrawal.purpose,
      'votes', v_withdrawal.votes, 'gross_amount', v_withdrawal.amount, 'fee', v_fee,
      'fee_percent', v_withdrawal.fee_percent, 'net_amount', v_net
    )
  ) RETURNING id INTO v_transaction_id;
  IF v_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount) VALUES (v_transaction_id,'group_withdrawal',v_fee);
  END IF;

  UPDATE public.withdrawal_requests
  SET status = 'executed', updated_at = now()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    v_withdrawal.requester_id,
    'wallet_credit',
    'Withdrawal Approved & Credited',
    format('₦%s from "%s" was approved by voters and credited to your wallet.',
      to_char(v_net, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_withdrawal.contribution_id,
    false
  );

  RETURN json_build_object(
    'success', true,
    'status', 'executed',
    'message', 'Withdrawal approved and credited to requester wallet',
    'amount', v_net, 'fee', v_fee, 'gross_amount', v_withdrawal.amount,
    'admin_new_balance', v_admin_balance_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
