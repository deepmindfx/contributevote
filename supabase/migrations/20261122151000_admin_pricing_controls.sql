BEGIN;

ALTER TABLE public.platform_pricing
  ADD COLUMN bank_transfer_fees_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN bank_transfer_small_fee numeric(10,2) NOT NULL DEFAULT 10.75 CHECK (bank_transfer_small_fee >= 0),
  ADD COLUMN bank_transfer_large_fee numeric(10,2) NOT NULL DEFAULT 26.50 CHECK (bank_transfer_large_fee >= 0),
  ADD COLUMN bank_transfer_threshold numeric(10,2) NOT NULL DEFAULT 5000 CHECK (bank_transfer_threshold BETWEEN 100 AND 500000),
  ADD COLUMN group_withdrawal_fees_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.group_withdrawal_fee_overrides (
  group_id uuid PRIMARY KEY REFERENCES public.contribution_groups(id) ON DELETE CASCADE,
  enabled boolean NOT NULL
);
ALTER TABLE public.group_withdrawal_fee_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_withdrawal_fee_overrides FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_pricing()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT to_jsonb(p) - ARRAY['singleton','updated_by'] FROM public.platform_pricing p WHERE singleton;
$$;

-- Keep the old signature available for existing clients without changing the new controls.
CREATE FUNCTION public.admin_save_transfer_pricing(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_daily integer := (p_settings->>'daily_free_transfers')::integer;
  v_friday boolean := (p_settings->>'friday_free')::boolean;
  v_bank boolean := (p_settings->>'bank_transfer_fees_enabled')::boolean;
  v_group boolean := (p_settings->>'group_withdrawal_fees_enabled')::boolean;
  v_small numeric := (p_settings->>'bank_transfer_small_fee')::numeric;
  v_large numeric := (p_settings->>'bank_transfer_large_fee')::numeric;
  v_threshold numeric := (p_settings->>'bank_transfer_threshold')::numeric;
  v_percent numeric := (p_settings->>'group_withdrawal_percent')::numeric;
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF v_daily IS NULL OR v_daily NOT BETWEEN 0 AND 100 OR v_friday IS NULL OR v_bank IS NULL OR v_group IS NULL
    OR v_small IS NULL OR v_small NOT BETWEEN 0 AND 500000 OR v_small <> round(v_small,2)
    OR v_large IS NULL OR v_large NOT BETWEEN 0 AND 500000 OR v_large <> round(v_large,2)
    OR v_threshold IS NULL OR v_threshold NOT BETWEEN 100 AND 500000 OR v_threshold <> round(v_threshold,2)
    OR v_percent IS NULL OR v_percent NOT BETWEEN 0 AND 99.99 OR v_percent <> round(v_percent,2) THEN
    RAISE EXCEPTION 'Enter valid pricing amounts and limits';
  END IF;
  UPDATE public.platform_pricing SET daily_free_transfers=v_daily,friday_free=v_friday,group_withdrawal_percent=v_percent,
    bank_transfer_fees_enabled=v_bank,group_withdrawal_fees_enabled=v_group,
    bank_transfer_small_fee=v_small,bank_transfer_large_fee=v_large,bank_transfer_threshold=v_threshold,
    updated_at=now(),updated_by=auth.uid() WHERE singleton;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,summary)
    VALUES(auth.uid(),'update_transfer_pricing','system','Updated bank transfer and group withdrawal fees');
  RETURN public.get_platform_pricing();
END;
$$;

CREATE FUNCTION public.get_group_withdrawal_policy(p_group_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'percent', CASE WHEN lower(g.category) = 'charity' OR NOT coalesce(o.enabled,p.group_withdrawal_fees_enabled)
      THEN 0 ELSE p.group_withdrawal_percent END,
    'override', o.enabled
  ) FROM public.contribution_groups g CROSS JOIN public.platform_pricing p
  LEFT JOIN public.group_withdrawal_fee_overrides o ON o.group_id=g.id
  WHERE p.singleton AND g.id=p_group_id AND (g.creator_id=auth.uid() OR public.is_admin());
$$;

CREATE FUNCTION public.admin_set_group_withdrawal_fee(p_group_id uuid,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  -- Use the same lock as priced withdrawal quotes and fee snapshots.
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR UPDATE;
  IF NOT EXISTS (SELECT FROM public.contribution_groups WHERE id=p_group_id) THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF p_enabled IS NULL THEN
    DELETE FROM public.group_withdrawal_fee_overrides WHERE group_id=p_group_id;
  ELSE
    INSERT INTO public.group_withdrawal_fee_overrides VALUES (p_group_id,p_enabled)
    ON CONFLICT(group_id) DO UPDATE SET enabled=excluded.enabled;
  END IF;
  INSERT INTO public.admin_audit_logs(admin_id,action,target_type,target_id,summary)
  VALUES(auth.uid(),'update_group_withdrawal_fee','group',p_group_id::text,'Updated this group’s withdrawal fee setting');
END;
$$;

CREATE OR REPLACE FUNCTION public.group_withdrawal_fee(p_group_id uuid, p_amount numeric)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT jsonb_build_object('percent',q.percent,
    'fee',least(round(p_amount*q.percent/100,2),greatest(p_amount-0.01,0)),'charity',q.charity)
  FROM (
    SELECT coalesce(lower(g.category)='charity',false) AS charity,
      CASE WHEN lower(g.category)='charity' OR NOT coalesce(o.enabled,p.group_withdrawal_fees_enabled)
        THEN 0 ELSE p.group_withdrawal_percent END AS percent
    FROM public.contribution_groups g CROSS JOIN public.platform_pricing p
    LEFT JOIN public.group_withdrawal_fee_overrides o ON o.group_id=g.id
    WHERE g.id=p_group_id AND p.singleton
  ) q;
$$;

REVOKE ALL ON FUNCTION public.admin_save_transfer_pricing(jsonb), public.admin_set_group_withdrawal_fee(uuid,boolean),
  public.get_group_withdrawal_policy(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_transfer_pricing(jsonb), public.admin_set_group_withdrawal_fee(uuid,boolean),
  public.get_group_withdrawal_policy(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.wallet_transfer_allowance(p_user_id uuid, p_at timestamptz DEFAULT statement_timestamp())
RETURNS jsonb LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH lagos_day AS (
    SELECT (p_at AT TIME ZONE 'Africa/Lagos')::date AS local_day
  ), usage AS (
    SELECT count(*) AS used
    FROM public.transactions t CROSS JOIN lagos_day d
    WHERE t.user_id = p_user_id AND t.type = 'transfer' AND t.payment_method = 'bank_transfer'
      AND t.status IN ('pending', 'completed')
      AND t.created_at >= (d.local_day::timestamp AT TIME ZONE 'Africa/Lagos')
      AND t.created_at < ((d.local_day + 1)::timestamp AT TIME ZONE 'Africa/Lagos')
  )
  SELECT jsonb_build_object(
    'daily_limit', p.daily_free_transfers, 'daily_remaining', greatest(p.daily_free_transfers - usage.used, 0),
    'friday_free', p.friday_free, 'free_today', p.friday_free AND extract(isodow FROM d.local_day) = 5,
    'fees_enabled', p.bank_transfer_fees_enabled, 'small_fee', p.bank_transfer_small_fee, 'large_fee', p.bank_transfer_large_fee, 'threshold', p.bank_transfer_threshold
  ) FROM public.platform_pricing p CROSS JOIN lagos_day d CROSS JOIN usage WHERE p.singleton;
$$;

CREATE OR REPLACE FUNCTION public.service_reserve_priced_transfer(
  p_user_id uuid, p_reference text, p_amount numeric, p_expected_fee numeric, p_metadata jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_wallet numeric;
  v_status text;
  v_quote jsonb;
  v_fee numeric;
  v_total numeric;
  v_reason text;
  v_existing public.transactions%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 500000 OR p_amount <> round(p_amount,2) OR p_reference IS NULL THEN
    RAISE EXCEPTION 'Invalid transfer details';
  END IF;
  SELECT coalesce(wallet_balance,0), coalesce(status,'active') INTO v_wallet,v_status
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'active' THEN RAISE EXCEPTION 'Account cannot send money'; END IF;
  SELECT * INTO v_existing FROM public.transactions
  WHERE reference_id = p_reference AND type = 'transfer' AND metadata ? 'pricing_reserved';
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id OR v_existing.amount IS DISTINCT FROM p_amount
      OR v_existing.metadata->>'account_bank' IS DISTINCT FROM p_metadata->>'account_bank'
      OR v_existing.metadata->>'account_number' IS DISTINCT FROM p_metadata->>'account_number' THEN
      RAISE EXCEPTION 'Transfer reference already used';
    END IF;
    RETURN jsonb_build_object('success',true,'replayed',true,'status',v_existing.status,
      'fee',v_existing.metadata->'fee','fee_reason',v_existing.metadata->>'fee_reason',
      'bank_name',v_existing.metadata->>'bank_name','created_at',v_existing.created_at);
  END IF;
  v_quote := public.wallet_transfer_allowance(p_user_id);
  IF NOT (v_quote->>'fees_enabled')::boolean THEN
    v_fee := 0; v_reason := 'fees_disabled';
  ELSIF (v_quote->>'free_today')::boolean THEN
    v_fee := 0; v_reason := 'friday';
  ELSIF (v_quote->>'daily_remaining')::integer > 0 THEN
    v_fee := 0; v_reason := 'daily';
  ELSE
    v_fee := CASE WHEN p_amount > (v_quote->>'threshold')::numeric
      THEN (v_quote->>'large_fee')::numeric ELSE (v_quote->>'small_fee')::numeric END;
    v_reason := 'standard';
  END IF;
  IF v_fee IS DISTINCT FROM p_expected_fee THEN
    RETURN jsonb_build_object('success',false,'error','The transfer fee changed. Review the updated total before sending.');
  END IF;
  v_total := p_amount + v_fee;
  IF v_wallet < v_total THEN RETURN jsonb_build_object('success',false,'error','Insufficient wallet balance'); END IF;

  UPDATE public.profiles SET wallet_balance = v_wallet - v_total, updated_at = now() WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id,type,amount,status,payment_method,reference_id,description,balance_before,balance_after,metadata)
  VALUES (p_user_id,'transfer',p_amount,'pending','bank_transfer',p_reference,
    'Bank transfer to ' || coalesce(p_metadata->>'beneficiary_name','recipient'),v_wallet,v_wallet-v_total,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('pricing_reserved',true,'fee',v_fee,'total_debited',v_total,'fee_reason',v_reason));
  RETURN jsonb_build_object('success',true,'fee',v_fee,'total',v_total,'fee_reason',v_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_priced_withdrawal_request(
  p_group_id uuid, p_amount numeric, p_purpose text, p_pin text, p_expected_fee numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  PERFORM 1 FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric IS DISTINCT FROM p_expected_fee THEN
    RAISE EXCEPTION 'The withdrawal fee changed. Reopen the withdrawal to review the updated amount.';
  END IF;
  RETURN public.create_withdrawal_request_safe(p_group_id,p_amount,p_purpose,p_pin)::jsonb;
END;
$$;

COMMIT;
