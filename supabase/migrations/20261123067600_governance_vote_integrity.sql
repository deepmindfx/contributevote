BEGIN;

CREATE OR REPLACE FUNCTION public.record_withdrawal_vote(p_withdrawal_id uuid,p_user_id uuid,p_vote boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.transactions(user_id,contribution_id,type,amount,description,status,payment_method,reference_id,metadata)
  SELECT p_user_id,w.contribution_id,'vote',w.amount,
    format('Voted %s on withdrawal request for %s',CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,w.purpose),
    'completed','system','VOTE_' || gen_random_uuid()::text,
    jsonb_build_object('withdrawal_id',w.id,'vote',CASE WHEN p_vote THEN 'approve' ELSE 'reject' END,
      'group_name',g.name,'withdrawal_amount',w.amount,'withdrawal_purpose',w.purpose,'voted_at',clock_timestamp())
  FROM public.withdrawal_requests w JOIN public.contribution_groups g ON g.id=w.contribution_id
  WHERE w.id=p_withdrawal_id AND p_vote IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.record_withdrawal_vote(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

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

  SELECT coalesce(cardinality(voter_ids),0),threshold INTO v_total_voters,v_threshold
  FROM public.governance_electorates WHERE kind='withdrawal' AND request_id=p_withdrawal_id;
  v_total_voters := coalesce(v_total_voters,0);
  v_threshold := coalesce(v_threshold,60);
  SELECT count(*) FILTER (WHERE vote='true'),count(*) FILTER (WHERE vote='false')
  INTO v_yes_votes,v_no_votes FROM public.valid_governance_ballots('withdrawal',p_withdrawal_id,v_withdrawal.votes,v_withdrawal.deadline);
  v_votes_cast := v_yes_votes+v_no_votes;
  v_participation_rate := CASE WHEN v_total_voters>0 THEN (v_votes_cast::numeric/v_total_voters)*100 ELSE 0 END;
  v_approval_rate := CASE WHEN v_votes_cast>0 THEN (v_yes_votes::numeric/v_votes_cast)*100 ELSE 0 END;
  v_max_possible_approval := CASE WHEN v_total_voters>0 THEN ((v_yes_votes+greatest(v_total_voters-v_votes_cast,0))::numeric/v_total_voters)*100 ELSE 0 END;

  -- Approval check: >= 70% participation AND >= group voting_threshold% approval
  IF v_total_voters>0 AND v_participation_rate >= v_participation_req AND v_approval_rate >= v_threshold THEN
    v_should_approve := true;
  -- Early mathematical rejection: all voters voted & failed, OR impossible to reach threshold even if all remaining vote Yes
  ELSIF (v_total_voters>0 AND v_votes_cast >= v_total_voters AND v_approval_rate < v_threshold)
     OR (v_participation_rate >= v_participation_req AND v_max_possible_approval < v_threshold) THEN
    v_should_reject := true;
  -- Deadline expiry check
  ELSIF v_withdrawal.deadline <= clock_timestamp() THEN
    v_should_reject := true;
  END IF;

  IF v_should_approve THEN
    UPDATE public.withdrawal_requests
    SET status = 'approved', verified_approval=true, updated_at = now()
    WHERE id = p_withdrawal_id;

    v_exec_res := public.process_approved_withdrawal(p_withdrawal_id);
    RETURN json_build_object(
      'success', true,
      'status', COALESCE(v_exec_res->>'status', 'approved'),
      'participation_rate', round(v_participation_rate, 1),
      'approval_rate', round(v_approval_rate, 1),
      'voting_threshold', v_threshold,
      'votes_cast', v_votes_cast,
      'yes_votes', v_yes_votes,
      'no_votes', v_no_votes,
      'total_voters', v_total_voters,
      'payout_pending', (v_exec_res->>'success')::boolean IS NOT TRUE
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

  IF p_vote IS NULL THEN RETURN json_build_object('success',false,'error','Choose a valid vote'); END IF;
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=v_uid AND coalesce(status,'active')='active')
    THEN RETURN json_build_object('success',false,'error','An active account is required to vote'); END IF;

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

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_withdrawal.contribution_id;

  IF v_group IS NULL OR COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Voting is paused because this group is not active');
  END IF;

  SELECT EXISTS (SELECT FROM public.governance_electorates WHERE kind='withdrawal'
    AND request_id=p_withdrawal_id AND v_uid=ANY(voter_ids)) INTO v_has_rights;
  IF NOT v_has_rights THEN RETURN json_build_object('success',false,'error','This vote is limited to eligible contributors when it opened'); END IF;
  IF v_withdrawal.deadline<=clock_timestamp() THEN
    PERFORM public.check_withdrawal_voting(p_withdrawal_id);
    RETURN json_build_object('success',false,'error','Voting deadline has passed');
  END IF;

  v_existing_votes := COALESCE(v_withdrawal.votes, '[]'::jsonb);
  IF EXISTS (SELECT FROM public.valid_governance_ballots('withdrawal',p_withdrawal_id,v_existing_votes,v_withdrawal.deadline)
    WHERE voter_id=v_uid::text AND vote=p_vote::text) THEN
    RETURN public.check_withdrawal_voting(p_withdrawal_id);
  END IF;

  -- Remove any previous vote by this exact user (idempotent upsert)
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_filtered_votes
  FROM jsonb_array_elements(v_existing_votes) AS elem
  WHERE elem->>'user_id' <> v_uid::text;

  v_new_votes := v_filtered_votes || jsonb_build_array(
    jsonb_build_object(
      'user_id', v_uid,
      'vote', p_vote,
      'voted_at', clock_timestamp()
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

  IF NOT NEW.verified_request THEN RETURN NEW; END IF;
  SELECT cardinality(voter_ids),threshold INTO v_eligible_voters,v_threshold
  FROM public.governance_electorates WHERE kind='refund' AND request_id=NEW.id;
  SELECT count(*) FILTER (WHERE vote='for'),count(*) FILTER (WHERE vote='against')
  INTO v_votes_for,v_votes_against FROM public.valid_governance_ballots('refund',NEW.id,NEW.votes,NEW.voting_deadline);
  v_total_votes:=v_votes_for+v_votes_against;

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

  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=v_uid AND coalesce(status,'active')='active')
    THEN RETURN json_build_object('success',false,'error','An active account is required to vote'); END IF;
  IF p_vote IS NULL OR p_vote NOT IN ('for', 'against') THEN
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

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = v_req.group_id;

  IF v_group IS NULL OR COALESCE(v_group.archived,false) OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Group is currently not active');
  END IF;

  SELECT EXISTS (SELECT FROM public.governance_electorates WHERE kind='refund'
    AND request_id=p_refund_request_id AND v_uid=ANY(voter_ids)) INTO v_has_rights;
  IF NOT v_has_rights THEN RETURN json_build_object('success',false,'error','This vote is limited to eligible contributors when it opened'); END IF;
  IF v_req.voting_deadline<=clock_timestamp() THEN
    UPDATE public.group_refund_requests SET status='rejected',updated_at=now() WHERE id=p_refund_request_id;
    RETURN json_build_object('success',false,'error','Voting deadline has passed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_req.votes, '[]'::jsonb)) elem
    WHERE elem->>'user_id' = v_uid::text
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already voted on this refund request');
  END IF;

  v_votes := COALESCE(v_req.votes, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('user_id', v_uid, 'vote', p_vote, 'voted_at', clock_timestamp())
  );

  SELECT count(*) FILTER (WHERE vote='for'),count(*) FILTER (WHERE vote='against')
  INTO v_votes_for,v_votes_against FROM public.valid_governance_ballots('refund',p_refund_request_id,v_votes,v_req.voting_deadline);
  v_total_votes:=v_votes_for+v_votes_against;
  SELECT cardinality(voter_ids),threshold INTO v_eligible,v_threshold FROM public.governance_electorates
    WHERE kind='refund' AND request_id=p_refund_request_id;

  UPDATE public.group_refund_requests
  SET votes = v_votes,
      total_votes_for = v_votes_for,
      total_votes_against = v_votes_against,
      total_eligible_voters = v_eligible,
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

CREATE OR REPLACE FUNCTION public.service_retry_approved_group_settlement(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result json;
BEGIN
  IF p_kind='withdrawal' THEN
    PERFORM 1 FROM public.withdrawal_requests WHERE id=p_id AND status='approved' AND verified_approval FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN false; END IF;
    v_result := public.process_approved_withdrawal(p_id);
    IF (v_result->>'success')::boolean IS NOT TRUE THEN
      UPDATE public.withdrawal_requests SET updated_at=now() WHERE id=p_id AND status='approved';
    END IF;
  ELSIF p_kind='refund' THEN
    PERFORM 1 FROM public.group_refund_requests WHERE id=p_id AND status='approved' AND verified_request FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN false; END IF;
    -- Keep the retry timestamp even when this attempt rolls back.
    BEGIN
      v_result := public.process_group_refund(p_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Approved group refund retry failed (SQLSTATE %)',SQLSTATE;
    END;
    IF (v_result->>'success')::boolean IS NOT TRUE THEN
      UPDATE public.group_refund_requests SET updated_at=now() WHERE id=p_id AND status='approved';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid settlement type';
  END IF;
  RETURN coalesce((v_result->>'success')::boolean,false);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_close_expired_refund_votes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Approval at quorum is already atomic with recording the last valid vote.
  UPDATE public.group_refund_requests SET status='rejected',updated_at=now()
  WHERE status='pending' AND voting_deadline<=clock_timestamp();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_withdrawal_vote(uuid,boolean),public.cast_refund_vote(uuid,text),
  public.check_withdrawal_voting(uuid),public.check_and_process_refund(),public.process_approved_withdrawal(uuid),
  public.service_retry_approved_group_settlement(text,uuid),public.service_close_expired_refund_votes()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cast_withdrawal_vote(uuid,boolean),public.cast_refund_vote(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_withdrawal_voting(uuid),public.process_approved_withdrawal(uuid),
  public.service_retry_approved_group_settlement(text,uuid),public.service_close_expired_refund_votes() TO service_role;
NOTIFY pgrst,'reload schema';

COMMIT;
