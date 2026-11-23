BEGIN;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_safe(
  p_group_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_requester record;
  v_pin_check json;
  v_group record;
  v_requester_name text;
  v_eligible_voters integer := 0;
  v_pending_total numeric := 0;
  v_available numeric := 0;
  v_request_id uuid;
  v_deadline timestamptz := now() + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT id, name, email, status, preferences INTO v_requester
  FROM public.profiles
  WHERE id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF COALESCE(v_requester.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', format('Your account is currently %s.', v_requester.status));
  END IF;

  v_pin_check := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin_check; END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero');
  END IF;

  IF trim(COALESCE(p_purpose, '')) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Please explain the purpose of this withdrawal');
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF v_group.creator_id IS DISTINCT FROM v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Only the group creator can request withdrawals');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Withdrawals are disabled while this group is %s.', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END)
    );
  END IF;

  IF v_group.enable_voting_rights = false THEN
    RETURN json_build_object('success', false, 'error', 'This group uses direct admin withdrawals rather than voting');
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_pending_total
  FROM public.withdrawal_requests
  WHERE contribution_id = p_group_id
    AND status IN ('pending','approved');

  v_available := COALESCE(v_group.current_amount, 0) - v_pending_total;

  IF p_amount > v_available THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Amount exceeds available unencumbered pool balance (₦%s).', to_char(GREATEST(v_available, 0), 'FM999,999,999,990.00'))
    );
  END IF;

  SELECT count(*) INTO v_eligible_voters
  FROM public.contributors
  WHERE group_id = p_group_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  IF v_eligible_voters = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'At least one contributor with verified voting rights is required before opening a withdrawal vote.'
    );
  END IF;

  v_requester_name := COALESCE(v_requester.name, v_requester.email, 'Group Admin');

  INSERT INTO public.withdrawal_requests (
    contribution_id, requester_id, amount, purpose, status, deadline, votes
  ) VALUES (
    p_group_id, v_uid, p_amount, trim(p_purpose), 'pending', v_deadline, '[]'::jsonb
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  SELECT
    c.user_id,
    'withdrawal_request',
    'New Withdrawal Vote Open',
    format('%s requested ₦%s from "%s". Cast your vote within 7 days.',
      v_requester_name,
      to_char(p_amount, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_request_id,
    false
  FROM public.contributors c
  WHERE c.group_id = p_group_id
    AND c.has_voting_rights = true
    AND c.user_id IS NOT NULL
    AND c.user_id <> v_uid;

  RETURN json_build_object(
    'success', true,
    'id', v_request_id,
    'deadline', v_deadline,
    'eligible_voters', v_eligible_voters
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_instant_withdrawal(
  p_group_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_admin record;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
  v_fee numeric;
  v_net numeric;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(),current_user) <> 'service_role' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized withdrawal requester';
  END IF;

  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT id, wallet_balance, status, preferences INTO v_admin
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group.enable_voting_rights IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF v_group.creator_id IS DISTINCT FROM p_admin_id THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Cannot withdraw while group is %', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END;
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance - (SELECT coalesce(sum(amount),0) FROM public.withdrawal_requests
      WHERE contribution_id=p_group_id AND status IN ('pending','approved')) < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  IF COALESCE(v_admin.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Your account is currently % and cannot withdraw funds', v_admin.status;
  END IF;

  v_admin_balance_before := COALESCE(v_admin.wallet_balance, 0);
  v_fee := (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric;
  v_net := p_amount - v_fee;
  v_admin_balance_after := v_admin_balance_before + v_net;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = p_admin_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_admin_id, p_group_id, 'withdrawal', v_net,
    'Instant withdrawal: ' || trim(COALESCE(p_purpose, '')), 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || replace(p_group_id::text, '-', '') || '_' || gen_random_uuid()::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting',
      'pin_verified', true, 'gross_amount', p_amount, 'fee', v_fee, 'net_amount', v_net
    )
  ) RETURNING id INTO v_transaction_id;
  IF v_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount) VALUES (v_transaction_id,'group_withdrawal',v_fee);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id,
    'wallet_credit',
    'Withdrawal Credited',
    format('₦%s withdrawn from "%s" and added to your wallet.', to_char(v_net, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

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

  IF v_withdrawal.status <> 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not approved');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_admin_balance_before
  FROM public.profiles
  WHERE id = v_withdrawal.requester_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Withdrawal recipient not found'); END IF;

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

NOTIFY pgrst, 'reload schema';
COMMIT;
