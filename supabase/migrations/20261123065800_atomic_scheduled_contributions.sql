BEGIN;

CREATE OR REPLACE FUNCTION public.contribute_from_wallet(
  p_user_id uuid,
  p_group_id uuid,
  p_amount numeric,
  p_anonymous boolean DEFAULT NULL,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user record;
  v_group record;
  v_pin_check json;
  v_user_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_contributor_id uuid;
  v_ref text;
  v_anonymous boolean;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized contribution attempt');
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum contribution amount is ₦100');
  END IF;

  SELECT id, wallet_balance, status, name, preferences
  INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF COALESCE(v_user.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Your account is currently %s and cannot make contributions. Contact support.', v_user.status)
    );
  END IF;

  IF v_caller IS NOT NULL THEN
    v_pin_check := public.check_wallet_pin(p_user_id,p_pin);
    IF (v_pin_check->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin_check; END IF;
  END IF;

  v_anonymous := coalesce(p_anonymous,(v_user.preferences->>'anonymousContributions') = 'true',false);
  v_user_balance := COALESCE(v_user.wallet_balance, 0);
  IF v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', v_user_balance,
      'required', p_amount
    );
  END IF;

  SELECT id, name, status, archived, current_amount, enable_voting_rights
  INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true THEN
    RETURN json_build_object('success', false, 'error', 'This group has been archived and is no longer accepting contributions');
  END IF;

  IF COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('This group is currently %s and cannot receive contributions', v_group.status)
    );
  END IF;

  v_new_balance := v_user_balance - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.contributors (
    group_id,
    user_id,
    amount,
    total_contributed,
    contribution_count,
    has_voting_rights,
    join_method,
    anonymous,
    joined_at,
    last_contribution_at
  ) VALUES (
    p_group_id,
    p_user_id,
    p_amount,
    p_amount,
    1,
    true,
    'wallet',
    v_anonymous,
    now(),
    now()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = COALESCE(public.contributors.total_contributed, 0) + p_amount,
      contribution_count = COALESCE(public.contributors.contribution_count, 0) + 1,
      has_voting_rights = true,
      anonymous = coalesce(public.contributors.anonymous,false) OR EXCLUDED.anonymous,
      last_contribution_at = now(),
      updated_at = now()
  RETURNING id INTO v_contributor_id;

  v_ref := 'WALLET_' || gen_random_uuid()::text;

  INSERT INTO public.transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group.name || ' from wallet',
    'completed',
    'wallet',
    v_ref,
    v_anonymous,
    v_user_balance,
    v_new_balance,
    jsonb_build_object(
      'source', 'wallet',
      'instant_voting_rights', COALESCE(v_group.enable_voting_rights, true),
      'contributor_id', v_contributor_id,
      'pin_verified', (v_caller IS NOT NULL)
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'reference', v_ref,
    'contributor_id', v_contributor_id,
    'new_balance', v_new_balance,
    'voting_rights_granted', COALESCE(v_group.enable_voting_rights, true)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION public.service_run_due_contribution(p_kind text,p_id uuid,p_expected_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE
  v_recurring public.recurring_contributions%ROWTYPE;
  v_scheduled public.scheduled_contributions%ROWTYPE;
  v_result json;
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_step interval;
BEGIN
  IF p_kind='scheduled' THEN
    SELECT * INTO v_scheduled FROM public.scheduled_contributions
    WHERE id=p_id AND status='pending' AND scheduled_date=p_expected_at AND scheduled_date<=v_now
    FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN 'skipped'; END IF;
    v_result := public.contribute_from_wallet(v_scheduled.user_id,v_scheduled.group_id,v_scheduled.amount,NULL,NULL);
    IF (v_result->>'success')::boolean IS NOT TRUE THEN
      UPDATE public.scheduled_contributions SET status='failed',failure_reason=left(v_result->>'error',240),updated_at=v_now WHERE id=p_id;
      RETURN 'failed';
    END IF;
    UPDATE public.scheduled_contributions SET status='completed',executed_at=v_now,updated_at=v_now WHERE id=p_id;
  ELSIF p_kind='recurring' THEN
    SELECT * INTO v_recurring FROM public.recurring_contributions
    WHERE id=p_id AND is_active AND next_contribution_date=p_expected_at AND next_contribution_date<=v_now
    FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN 'skipped'; END IF;
    IF v_recurring.end_date < v_now THEN
      UPDATE public.recurring_contributions SET is_active=false,updated_at=v_now WHERE id=p_id;
      RETURN 'skipped';
    END IF;
    v_result := public.contribute_from_wallet(v_recurring.user_id,v_recurring.group_id,v_recurring.amount,NULL,NULL);
    IF (v_result->>'success')::boolean IS NOT TRUE THEN RETURN 'failed'; END IF;
    v_next := v_recurring.next_contribution_date;
    v_step := CASE v_recurring.frequency WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' END;
    IF v_step IS NOT NULL THEN
      v_next := v_next + v_step * (floor(extract(epoch FROM (v_now-v_next))/extract(epoch FROM v_step)) + 1);
    ELSE
      -- Retain UTC month rollover and skip past missed dates with one charge.
      FOR v_pass IN 1..400 LOOP
        v_next := date_trunc('month',v_next)+interval '1 month'+(v_next-date_trunc('month',v_next));
        EXIT WHEN v_next>v_now;
      END LOOP;
      IF v_next<=v_now THEN v_next := v_now+interval '1 month'; END IF;
    END IF;
    UPDATE public.recurring_contributions SET next_contribution_date=v_next,
      is_active=(v_recurring.end_date IS NULL OR v_next<=v_recurring.end_date),
      total_contributions=coalesce(total_contributions,0)+1,total_amount=coalesce(total_amount,0)+v_recurring.amount,
      last_contribution_at=v_now,updated_at=v_now WHERE id=p_id;
  ELSE
    RAISE EXCEPTION 'Invalid scheduled contribution type';
  END IF;
  RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.service_run_due_contribution(text,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_run_due_contribution(text,uuid,timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
