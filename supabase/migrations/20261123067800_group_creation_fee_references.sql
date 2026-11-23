BEGIN;

CREATE OR REPLACE FUNCTION public.create_group_with_fee_internal(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_target_amount numeric,
  p_category text,
  p_frequency text,
  p_privacy text DEFAULT 'public'::text,
  p_enable_voting_rights boolean DEFAULT true,
  p_contribution_amount numeric DEFAULT NULL::numeric,
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_voting_threshold numeric DEFAULT 60,
  p_cover_image_url text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_free_remaining integer;
  v_wallet_balance numeric;
  v_balance_after numeric;
  v_bvn text;
  v_status text;
  v_role text;
  v_recent_24h integer := 0;
  v_creation_fee numeric := 500;
  v_group_id uuid;
  v_transaction_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized user context');
  END IF;

  SELECT
    COALESCE(groups_created_free_remaining, 0),
    COALESCE(wallet_balance, 0),
    bvn,
    COALESCE(status, 'active'),
    COALESCE(role, 'user')
  INTO v_free_remaining, v_wallet_balance, v_bvn, v_status, v_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF v_status <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'ACCOUNT_RESTRICTED',
      'error', format('Your account is currently %s. Group creation is disabled.', v_status)
    );
  END IF;

  IF v_bvn IS NULL OR trim(v_bvn) !~ '^[0-9]{11}$' THEN
    RETURN json_build_object(
      'success', false,
      'code', 'BVN_REQUIRED',
      'error', 'BVN verification is required before creating a group pool (AML/KYC policy).'
    );
  END IF;

  SELECT count(*) INTO v_recent_24h
  FROM public.contribution_groups
  WHERE creator_id = p_user_id
    AND created_at >= now() - interval '24 hours';

  IF v_role <> 'admin' AND v_recent_24h >= 3 THEN
    INSERT INTO public.aml_alerts (
      alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
    ) VALUES (
      'group_churn:' || p_user_id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
      p_user_id,
      'rapid_group_churn',
      'high',
      79,
      COALESCE(p_target_amount, 0),
      'Rapid Group Pool Creation Attempt',
      'User attempted to create more than 3 group pools within 24 hours (blocked by AML guard).',
      jsonb_build_object('recent_24h_count', v_recent_24h, 'attempted_name', p_name, 'target_amount', p_target_amount)
    ) ON CONFLICT (alert_key) DO NOTHING;

    RETURN json_build_object(
      'success', false,
      'code', 'GROUP_RATE_LIMIT',
      'error', 'Safety limit reached: you can create up to 3 group pools per 24 hours.'
    );
  END IF;

  IF v_free_remaining <= 0 THEN
    IF v_wallet_balance < v_creation_fee THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'message', format('You need ₦%s to create a group. Current balance: ₦%s', v_creation_fee, v_wallet_balance),
        'required_amount', v_creation_fee,
        'current_balance', v_wallet_balance
      );
    END IF;

    v_balance_after := v_wallet_balance - v_creation_fee;

    UPDATE public.profiles
    SET wallet_balance = v_balance_after,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO public.transactions (
      user_id, type, amount, description, status, payment_method, reference_id, balance_before, balance_after
    ) VALUES (
      p_user_id, 'withdrawal', v_creation_fee,
      'Group creation fee for: ' || p_name, 'completed', 'wallet',
      'GROUP_FEE_' || gen_random_uuid()::text,
      v_wallet_balance, v_balance_after
    ) RETURNING id INTO v_transaction_id;
  END IF;

  INSERT INTO public.contribution_groups (
    name, description, target_amount, contribution_amount, category, frequency,
    start_date, end_date, creator_id, privacy, status, enable_voting_rights,
    voting_threshold, cover_image_url
  ) VALUES (
    p_name, p_description, p_target_amount, p_contribution_amount, p_category, p_frequency,
    COALESCE(p_start_date, now()), p_end_date, p_user_id, p_privacy, 'active',
    p_enable_voting_rights, p_voting_threshold, NULLIF(trim(COALESCE(p_cover_image_url, '')), '')
  ) RETURNING id INTO v_group_id;

  UPDATE public.profiles
  SET
    groups_created_count = COALESCE(groups_created_count, 0) + 1,
    groups_created_free_remaining = GREATEST(v_free_remaining - 1, 0),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'group_id', v_group_id,
    'fee_charged', CASE WHEN v_free_remaining > 0 THEN 0 ELSE v_creation_fee END,
    'free_remaining', GREATEST(v_free_remaining - 1, 0),
    'transaction_id', v_transaction_id,
    'message', CASE
      WHEN v_free_remaining > 0 THEN 'Group created successfully (free)'
      ELSE format('Group created successfully (₦%s charged)', v_creation_fee)
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

COMMIT;
