-- Voting Governance Integrity & Rules Enforcement
-- Ensures custom voting_threshold (50/60/75/80%), 70% participation quorum,
-- atomic race-free voting RPCs, early rejection, AML freeze payout blocks,
-- and clean UTF-8 notifications work end-to-end across withdrawals and refunds.

-- ============================================================================
-- 1. ATOMIC WITHDRAWAL REQUEST CREATION (WITH ELIGIBLE-VOTER & FREEZE CHECKS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_safe(
  p_group_id uuid,
  p_amount numeric,
  p_purpose text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
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

  IF v_group.creator_id <> v_uid AND NOT public.is_admin() THEN
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
    AND status = 'pending';

  v_available := COALESCE(v_group.current_amount, 0) - v_pending_total;

  IF p_amount > v_available THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Amount exceeds available unencumbered pool balance (NGN %s).', to_char(GREATEST(v_available, 0), 'FM999,999,999,990.00'))
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

  SELECT COALESCE(name, email, 'Group Admin') INTO v_requester_name
  FROM public.profiles
  WHERE id = v_uid;

  INSERT INTO public.withdrawal_requests (
    contribution_id, requester_id, amount, purpose, status, deadline, votes
  ) VALUES (
    p_group_id, v_uid, p_amount, trim(p_purpose), 'pending', v_deadline, '[]'::jsonb
  ) RETURNING id INTO v_request_id;

  -- Notify all eligible voters (excluding the requester) atomically inside DB
  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  SELECT
    c.user_id,
    'withdrawal_request',
    'New Withdrawal Vote Open',
    format('%s requested NGN %s from "%s". Cast your vote within 7 days.',
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

-- ============================================================================
-- 2. WITHDRAWAL VOTING EVALUATION & EXECUTION (RESPECTS CUSTOM THRESHOLD)
-- ============================================================================

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

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id
  FOR UPDATE;

  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contribution group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Group is not active; payout blocked pending compliance review');
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < v_withdrawal.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient group balance');
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_admin_balance_before
  FROM public.profiles
  WHERE id = v_withdrawal.requester_id
  FOR UPDATE;

  v_admin_balance_after := v_admin_balance_before + v_withdrawal.amount;

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
    v_withdrawal.amount, 'Withdrawal approved: ' || v_withdrawal.purpose,
    'completed', 'wallet', 'WITHDRAWAL_' || p_withdrawal_id::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'group_id', v_withdrawal.contribution_id,
      'purpose', v_withdrawal.purpose,
      'votes', v_withdrawal.votes
    )
  );

  UPDATE public.withdrawal_requests
  SET status = 'executed', updated_at = now()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    v_withdrawal.requester_id,
    'withdrawal',
    'Withdrawal Approved & Credited',
    format('NGN %s from "%s" was approved by voters and credited to your wallet.',
      to_char(v_withdrawal.amount, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_withdrawal.contribution_id,
    false
  );

  RETURN json_build_object(
    'success', true,
    'status', 'executed',
    'message', 'Withdrawal approved and credited to requester wallet',
    'amount', v_withdrawal.amount,
    'admin_new_balance', v_admin_balance_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_withdrawal_voting(p_withdrawal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_withdrawal record;
  v_group record;
  v_threshold numeric := 60;
  v_participation_req numeric := 70;
  v_total_voters integer := 0;
  v_votes_cast integer := 0;
  v_yes_votes integer := 0;
  v_no_votes integer := 0;
  v_participation_rate numeric := 0;
  v_approval_rate numeric := 0;
  v_max_possible_approval numeric := 0;
  v_should_approve boolean := false;
  v_should_reject boolean := false;
  v_exec_res json;
BEGIN
  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_withdrawal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status <> 'pending' THEN
    RETURN json_build_object('success', true, 'status', v_withdrawal.status);
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id;

  -- Use the group's configured voting_threshold (default 60%, normalize legacy values < 50)
  v_threshold := CASE
    WHEN v_group.voting_threshold IS NOT NULL AND v_group.voting_threshold >= 50 AND v_group.voting_threshold <= 100
      THEN v_group.voting_threshold
    ELSE 60
  END;

  SELECT count(*) INTO v_total_voters
  FROM public.contributors
  WHERE group_id = v_withdrawal.contribution_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  IF v_total_voters = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No eligible voters in group');
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE (elem->>'vote')::boolean = true),
    count(*) FILTER (WHERE (elem->>'vote')::boolean = false)
  INTO v_votes_cast, v_yes_votes, v_no_votes
  FROM jsonb_array_elements(COALESCE(v_withdrawal.votes, '[]'::jsonb)) AS elem;

  v_participation_rate := (v_votes_cast::numeric / v_total_voters::numeric) * 100;
  v_approval_rate := CASE
    WHEN v_votes_cast > 0 THEN (v_yes_votes::numeric / v_votes_cast::numeric) * 100
    ELSE 0
  END;
  v_max_possible_approval := ((v_yes_votes + GREATEST(v_total_voters - v_votes_cast, 0))::numeric / v_total_voters::numeric) * 100;

  -- Approval check: >= 70% participation AND >= group voting_threshold% approval
  IF v_participation_rate >= v_participation_req AND v_approval_rate >= v_threshold THEN
    v_should_approve := true;
  -- Early mathematical rejection: all voters voted & failed, OR impossible to reach threshold even if all remaining vote Yes
  ELSIF (v_votes_cast >= v_total_voters AND v_approval_rate < v_threshold)
     OR (v_participation_rate >= v_participation_req AND v_max_possible_approval < v_threshold) THEN
    v_should_reject := true;
  -- Deadline expiry check
  ELSIF v_withdrawal.deadline < now() THEN
    v_should_reject := true;
  END IF;

  IF v_should_approve THEN
    UPDATE public.withdrawal_requests
    SET status = 'approved', updated_at = now()
    WHERE id = p_withdrawal_id;

    v_exec_res := public.process_approved_withdrawal(p_withdrawal_id);
    RETURN json_build_object(
      'success', COALESCE((v_exec_res->>'success')::boolean, true),
      'status', COALESCE(v_exec_res->>'status', 'approved'),
      'participation_rate', round(v_participation_rate, 1),
      'approval_rate', round(v_approval_rate, 1),
      'voting_threshold', v_threshold,
      'votes_cast', v_votes_cast,
      'yes_votes', v_yes_votes,
      'no_votes', v_no_votes,
      'total_voters', v_total_voters,
      'error', v_exec_res->>'error'
    );
  END IF;

  IF v_should_reject THEN
    UPDATE public.withdrawal_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
    VALUES (
      v_withdrawal.requester_id,
      'withdrawal',
      'Withdrawal Request Rejected',
      format('Your NGN %s withdrawal request for "%s" did not meet the %s%% approval threshold.',
        to_char(v_withdrawal.amount, 'FM999,999,999,990.00'),
        COALESCE(v_group.name, 'group pool'),
        v_threshold::integer
      ),
      v_withdrawal.contribution_id,
      false
    );

    RETURN json_build_object(
      'success', true,
      'status', 'rejected',
      'participation_rate', round(v_participation_rate, 1),
      'approval_rate', round(v_approval_rate, 1),
      'voting_threshold', v_threshold,
      'votes_cast', v_votes_cast,
      'yes_votes', v_yes_votes,
      'no_votes', v_no_votes,
      'total_voters', v_total_voters
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'status', 'pending',
    'participation_rate', round(v_participation_rate, 1),
    'approval_rate', round(v_approval_rate, 1),
    'voting_threshold', v_threshold,
    'votes_cast', v_votes_cast,
    'yes_votes', v_yes_votes,
    'no_votes', v_no_votes,
    'total_voters', v_total_voters
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_withdrawal_vote(
  p_withdrawal_id uuid,
  p_vote boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_withdrawal record;
  v_group record;
  v_has_rights boolean := false;
  v_existing_votes jsonb;
  v_filtered_votes jsonb;
  v_new_votes jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF v_withdrawal.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', format('Voting is closed (status: %s)', v_withdrawal.status));
  END IF;

  IF v_withdrawal.deadline < now() THEN
    RETURN public.check_withdrawal_voting(p_withdrawal_id);
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id;

  IF v_group IS NULL OR COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Voting is paused because this group is not active');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contributors
    WHERE group_id = v_withdrawal.contribution_id
      AND user_id = v_uid
      AND has_voting_rights = true
  ) INTO v_has_rights;

  IF NOT v_has_rights THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only verified contributors with voting rights in this group can vote'
    );
  END IF;

  v_existing_votes := COALESCE(v_withdrawal.votes, '[]'::jsonb);

  -- Remove any previous vote by this exact user (idempotent upsert)
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_filtered_votes
  FROM jsonb_array_elements(v_existing_votes) AS elem
  WHERE elem->>'user_id' <> v_uid::text;

  v_new_votes := v_filtered_votes || jsonb_build_array(
    jsonb_build_object(
      'user_id', v_uid,
      'vote', p_vote,
      'voted_at', now()
    )
  );

  UPDATE public.withdrawal_requests
  SET votes = v_new_votes,
      updated_at = now()
  WHERE id = p_withdrawal_id;

  -- Record audit transaction for user's vote
  PERFORM public.record_withdrawal_vote(p_withdrawal_id, v_uid, p_vote);

  -- Immediately evaluate quorum & approval threshold (and auto-execute/reject if met)
  RETURN public.check_withdrawal_voting(p_withdrawal_id);
END;
$$;

-- ============================================================================
-- 3. INSTANT WITHDRAWAL HARDENING (FROZEN GROUP CHECK + CLEAN BALANCE SNAPSHOT)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_instant_withdrawal(
  p_group_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_purpose text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized withdrawal requester';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group.enable_voting_rights <> false THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF v_group.creator_id <> p_admin_id THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Cannot withdraw while group is %', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END;
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  SELECT COALESCE(wallet_balance, 0) INTO v_admin_balance_before
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  v_admin_balance_after := v_admin_balance_before + p_amount;

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
    p_admin_id, p_group_id, 'withdrawal', p_amount,
    'Instant withdrawal: ' || trim(COALESCE(p_purpose, '')), 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || replace(p_group_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting'
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id,
    'withdrawal',
    'Withdrawal Credited',
    format('NGN %s withdrawn from "%s" and added to your wallet.', to_char(p_amount, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

-- ============================================================================
-- 4. ATOMIC REFUND VOTING & THRESHOLD ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_and_process_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_votes_for int;
  v_votes_against int;
  v_total_votes int;
  v_eligible_voters int;
  v_threshold numeric := 60;
  v_participation_rate numeric;
  v_approval_rate numeric;
  v_max_possible_approval numeric;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN voting_threshold IS NOT NULL AND voting_threshold >= 50 AND voting_threshold <= 100
      THEN voting_threshold
    ELSE 60
  END INTO v_threshold
  FROM public.contribution_groups
  WHERE id = NEW.group_id;

  v_votes_for := COALESCE(NEW.total_votes_for, 0);
  v_votes_against := COALESCE(NEW.total_votes_against, 0);
  v_total_votes := v_votes_for + v_votes_against;

  SELECT count(*) INTO v_eligible_voters
  FROM public.contributors
  WHERE group_id = NEW.group_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  IF v_eligible_voters = 0 THEN
    v_eligible_voters := COALESCE(NEW.total_eligible_voters, 0);
  END IF;

  v_participation_rate := CASE WHEN v_eligible_voters > 0 THEN (v_total_votes::numeric / v_eligible_voters) * 100 ELSE 0 END;
  v_approval_rate := CASE WHEN v_total_votes > 0 THEN (v_votes_for::numeric / v_total_votes) * 100 ELSE 0 END;
  v_max_possible_approval := CASE
    WHEN v_eligible_voters > 0 THEN ((v_votes_for + GREATEST(v_eligible_voters - v_total_votes, 0))::numeric / v_eligible_voters) * 100
    ELSE 0
  END;

  IF v_participation_rate >= 70 AND v_approval_rate >= v_threshold THEN
    UPDATE public.group_refund_requests
    SET status = 'approved', updated_at = now()
    WHERE id = NEW.id AND status = 'pending';

    IF FOUND THEN
      PERFORM public.process_group_refund(NEW.id);
    END IF;
  ELSIF (v_eligible_voters > 0 AND v_total_votes >= v_eligible_voters AND v_approval_rate < v_threshold)
     OR (v_participation_rate >= 70 AND v_max_possible_approval < v_threshold) THEN
    UPDATE public.group_refund_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_refund_vote(
  p_refund_request_id uuid,
  p_vote text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
  v_group record;
  v_has_rights boolean := false;
  v_votes jsonb;
  v_votes_for integer := 0;
  v_votes_against integer := 0;
  v_total_votes integer := 0;
  v_eligible integer := 0;
  v_threshold numeric := 60;
  v_participation numeric := 0;
  v_approval numeric := 0;
  v_final_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_vote NOT IN ('for', 'against') THEN
    RETURN json_build_object('success', false, 'error', 'Vote must be "for" or "against"');
  END IF;

  SELECT * INTO v_req
  FROM public.group_refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Refund request not found');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', format('Voting is closed (status: %s)', v_req.status));
  END IF;

  IF v_req.voting_deadline < now() THEN
    UPDATE public.group_refund_requests SET status = 'rejected', updated_at = now() WHERE id = p_refund_request_id;
    RETURN json_build_object('success', false, 'error', 'Voting deadline has passed');
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_req.group_id;

  IF v_group IS NULL OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Group is currently not active');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contributors
    WHERE group_id = v_req.group_id
      AND user_id = v_uid
      AND has_voting_rights = true
  ) INTO v_has_rights;

  IF NOT v_has_rights THEN
    RETURN json_build_object('success', false, 'error', 'Only verified contributors with voting rights can vote on refunds');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_req.votes, '[]'::jsonb)) elem
    WHERE elem->>'user_id' = v_uid::text
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already voted on this refund request');
  END IF;

  v_votes := COALESCE(v_req.votes, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('user_id', v_uid, 'vote', p_vote, 'voted_at', now())
  );

  SELECT
    count(*) FILTER (WHERE elem->>'vote' = 'for'),
    count(*) FILTER (WHERE elem->>'vote' = 'against')
  INTO v_votes_for, v_votes_against
  FROM jsonb_array_elements(v_votes) AS elem;

  v_total_votes := v_votes_for + v_votes_against;

  SELECT count(*) INTO v_eligible
  FROM public.contributors
  WHERE group_id = v_req.group_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  v_threshold := CASE
    WHEN v_group.voting_threshold IS NOT NULL AND v_group.voting_threshold >= 50 AND v_group.voting_threshold <= 100
      THEN v_group.voting_threshold
    ELSE 60
  END;

  UPDATE public.group_refund_requests
  SET votes = v_votes,
      total_votes_for = v_votes_for,
      total_votes_against = v_votes_against,
      total_eligible_voters = GREATEST(v_eligible, COALESCE(total_eligible_voters, 0)),
      updated_at = now()
  WHERE id = p_refund_request_id;

  -- Trigger check_and_process_refund ran AFTER UPDATE above; read final status
  SELECT status INTO v_final_status
  FROM public.group_refund_requests
  WHERE id = p_refund_request_id;

  v_participation := CASE WHEN v_eligible > 0 THEN (v_total_votes::numeric / v_eligible) * 100 ELSE 0 END;
  v_approval := CASE WHEN v_total_votes > 0 THEN (v_votes_for::numeric / v_total_votes) * 100 ELSE 0 END;

  RETURN json_build_object(
    'success', true,
    'status', v_final_status,
    'participation_rate', round(v_participation, 1),
    'approval_rate', round(v_approval, 1),
    'voting_threshold', v_threshold,
    'votes_for', v_votes_for,
    'votes_against', v_votes_against,
    'eligible_voters', v_eligible
  );
END;
$$;

-- Tighten withdrawal_requests UPDATE policy to require verified voting rights
DROP POLICY IF EXISTS "Users can update withdrawal requests for voting" ON public.withdrawal_requests;
CREATE POLICY "Verified voters can update pending withdrawal requests"
  ON public.withdrawal_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' AND EXISTS (
      SELECT 1 FROM public.contributors c
      WHERE c.group_id = withdrawal_requests.contribution_id
        AND c.user_id = auth.uid()
        AND c.has_voting_rights = true
    )
  );

GRANT EXECUTE ON FUNCTION public.create_withdrawal_request_safe(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_withdrawal_vote(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_refund_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_withdrawal_voting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_approved_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_instant_withdrawal(uuid, uuid, numeric, text) TO authenticated;
