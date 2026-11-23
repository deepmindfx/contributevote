BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT FROM public.profiles WHERE id=auth.uid() AND role='admin' AND coalesce(status,'active')='active');
$$;

CREATE FUNCTION public.can_view_group(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT FROM public.contribution_groups g WHERE g.id=p_group_id AND (
      (g.privacy='public' AND NOT coalesce(g.archived,false))
      OR (auth.uid() IS NOT NULL AND (g.creator_id=auth.uid() OR public.is_admin() OR EXISTS (
        SELECT FROM public.contributors c WHERE c.group_id=g.id AND c.user_id=auth.uid()
      )))
    )
  );
$$;

CREATE FUNCTION public.can_manage_group_roster(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_admin() OR EXISTS (
    SELECT FROM public.contribution_groups WHERE id=p_group_id AND creator_id=auth.uid()
  ));
$$;
REVOKE ALL ON FUNCTION public.can_view_group(uuid),public.can_manage_group_roster(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_group(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group_roster(uuid) TO authenticated;

CREATE POLICY "Group visibility boundary" ON public.contribution_groups AS RESTRICTIVE FOR SELECT
  TO anon,authenticated USING (public.can_view_group(id));
CREATE POLICY "Visible groups" ON public.contribution_groups FOR SELECT TO anon,authenticated USING (public.can_view_group(id));

CREATE POLICY "Contributor identity boundary" ON public.contributors AS RESTRICTIVE FOR SELECT
  TO authenticated USING (user_id=auth.uid() OR public.can_manage_group_roster(group_id));
CREATE POLICY "Contributor roster access" ON public.contributors FOR SELECT
  TO authenticated USING (user_id=auth.uid() OR public.can_manage_group_roster(group_id));
REVOKE SELECT ON public.contributors FROM PUBLIC,anon;

REVOKE DELETE ON public.contribution_groups FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.delete_empty_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.contribution_groups WHERE id=p_group_id AND creator_id=auth.uid() AND current_amount=0
    AND account_number IS NULL AND account_reference IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT FROM public.transactions WHERE contribution_id=p_group_id)
    OR EXISTS (SELECT FROM public.group_bank_account_setups WHERE group_id=p_group_id)
    OR EXISTS (SELECT FROM public.contributors WHERE group_id=p_group_id AND coalesce(total_contributed,0)<>0) THEN
    RAISE EXCEPTION 'This group cannot be deleted. Archive groups with bank setup or a payment history.';
  END IF;
  DELETE FROM public.contribution_groups WHERE id=p_group_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_empty_group(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_empty_group(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.lookup_user_id_by_email(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.resolve_admin_login_email(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_group_contributors_safe(p_group_id UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  user_id UUID,
  amount NUMERIC,
  total_contributed NUMERIC,
  contribution_count INTEGER,
  has_voting_rights BOOLEAN,
  join_method VARCHAR,
  anonymous BOOLEAN,
  joined_at TIMESTAMPTZ,
  last_contribution_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  contributor_name TEXT,
  contributor_avatar TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_group(p_group_id) THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    c.id,
    c.group_id,
    CASE WHEN NOT coalesce(c.anonymous,false) OR c.user_id=auth.uid() OR public.can_manage_group_roster(p_group_id) THEN c.user_id ELSE NULL END,
    c.amount,
    c.total_contributed::NUMERIC,
    c.contribution_count,
    c.has_voting_rights,
    c.join_method,
    c.anonymous,
    c.joined_at,
    c.last_contribution_at,
    CASE WHEN c.user_id=auth.uid() OR public.can_manage_group_roster(p_group_id) THEN c.metadata ELSE '{}'::jsonb END,
    c.created_at,
    CASE
      WHEN c.anonymous = true THEN 'Anonymous'
      ELSE COALESCE(p.name, 'Contributor')
    END AS contributor_name,
    CASE
      WHEN c.anonymous = true THEN NULL
      ELSE p.preferences->>'profileImage'
    END AS contributor_avatar
  FROM public.contributors c
  LEFT JOIN public.profiles p ON c.user_id = p.id
  WHERE c.group_id = p_group_id
  ORDER BY c.total_contributed DESC, c.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path='';
REVOKE ALL ON FUNCTION public.get_group_contributors_safe(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_contributors_safe(uuid) TO authenticated;

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

  IF p_amount IS NULL OR p_amount < 100 OR p_amount > 99999999.99 OR p_amount<>round(p_amount,2) THEN
    RETURN json_build_object('success', false, 'error', 'Enter a contribution of at least ₦100 with no more than two decimal places');
  END IF;

  SELECT id, wallet_balance, status, name, preferences
  INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR NO KEY UPDATE;

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

  SELECT id, name, status, archived, current_amount, enable_voting_rights, privacy, creator_id
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

  IF v_group.privacy IS DISTINCT FROM 'public' AND v_group.creator_id IS DISTINCT FROM p_user_id
    AND NOT EXISTS (SELECT FROM public.contributors WHERE group_id=p_group_id AND user_id=p_user_id) THEN
    RETURN json_build_object('success',false,'error','Join this private group before contributing.');
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

NOTIFY pgrst,'reload schema';
COMMIT;
