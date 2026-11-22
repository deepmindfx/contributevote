BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_pricing (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  daily_free_transfers integer NOT NULL DEFAULT 1 CHECK (daily_free_transfers BETWEEN 0 AND 100),
  friday_free boolean NOT NULL DEFAULT true,
  group_withdrawal_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (group_withdrawal_percent BETWEEN 0 AND 99.99),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.platform_pricing (singleton) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.platform_pricing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_pricing FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.platform_fee_ledger (
  transaction_id uuid PRIMARY KEY REFERENCES public.transactions(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('bank_transfer', 'group_withdrawal')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  earned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_fee_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_fee_ledger FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS pricing_transfer_usage_idx ON public.transactions (user_id, created_at)
  WHERE type = 'transfer' AND payment_method = 'bank_transfer' AND status IN ('pending', 'completed');
CREATE UNIQUE INDEX IF NOT EXISTS pricing_reserved_transfer_reference_idx ON public.transactions (reference_id)
  WHERE type = 'transfer' AND metadata ? 'pricing_reserved';

CREATE OR REPLACE FUNCTION public.get_platform_pricing()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'daily_free_transfers', daily_free_transfers, 'friday_free', friday_free,
    'group_withdrawal_percent', group_withdrawal_percent, 'updated_at', updated_at
  ) FROM public.platform_pricing WHERE singleton;
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_pricing_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_revenue jsonb;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT jsonb_build_object(
    'bank_transfer', coalesce(sum(amount) FILTER (WHERE source = 'bank_transfer'), 0),
    'group_withdrawal', coalesce(sum(amount) FILTER (WHERE source = 'group_withdrawal'), 0),
    'last_30_days', coalesce(sum(amount) FILTER (WHERE earned_at >= now() - interval '30 days'), 0),
    'total', coalesce(sum(amount), 0)
  ) INTO v_revenue FROM public.platform_fee_ledger;
  RETURN jsonb_build_object('pricing', public.get_platform_pricing(), 'revenue', v_revenue);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_platform_pricing(
  p_daily_free integer, p_friday_free boolean, p_withdrawal_percent numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_daily_free IS NULL OR p_daily_free NOT BETWEEN 0 AND 100 OR p_friday_free IS NULL
    OR p_withdrawal_percent IS NULL OR p_withdrawal_percent NOT BETWEEN 0 AND 99.99
    OR p_withdrawal_percent <> round(p_withdrawal_percent, 2) THEN
    RAISE EXCEPTION 'Invalid pricing values';
  END IF;
  UPDATE public.platform_pricing SET daily_free_transfers = p_daily_free, friday_free = p_friday_free,
    group_withdrawal_percent = p_withdrawal_percent, updated_by = auth.uid(), updated_at = now() WHERE singleton;
  RETURN public.get_platform_pricing();
END;
$$;

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
    'small_fee', 10.75, 'large_fee', 26.50, 'threshold', 5000
  ) FROM public.platform_pricing p CROSS JOIN lagos_day d CROSS JOIN usage WHERE p.singleton;
$$;

CREATE OR REPLACE FUNCTION public.get_wallet_transfer_allowance()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.wallet_transfer_allowance(auth.uid()) WHERE auth.uid() IS NOT NULL;
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
  IF (v_quote->>'free_today')::boolean THEN
    v_fee := 0; v_reason := 'friday';
  ELSIF (v_quote->>'daily_remaining')::integer > 0 THEN
    v_fee := 0; v_reason := 'daily';
  ELSE
    v_fee := CASE WHEN p_amount > 5000 THEN 26.50 ELSE 10.75 END; v_reason := 'standard';
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

CREATE OR REPLACE FUNCTION public.service_settle_priced_transfer(p_reference text, p_status text, p_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_transfer public.transactions%ROWTYPE;
  v_fee numeric;
  v_refund numeric;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','completed','failed') THEN RAISE EXCEPTION 'Invalid transfer status'; END IF;
  SELECT * INTO v_transfer FROM public.transactions WHERE type = 'transfer' AND reference_id = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
  IF v_transfer.status IN ('completed','failed') THEN
    RETURN jsonb_build_object('found',true,'status',v_transfer.status);
  END IF;
  v_fee := coalesce((v_transfer.metadata->>'fee')::numeric,0);
  IF p_status = 'failed' THEN
    v_refund := coalesce((v_transfer.metadata->>'total_debited')::numeric, v_transfer.amount + v_fee);
    UPDATE public.profiles SET wallet_balance = coalesce(wallet_balance,0) + v_refund, updated_at = now()
    WHERE id = v_transfer.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer refund account not found'; END IF;
    INSERT INTO public.notifications (user_id,type,title,message,is_read)
    VALUES (v_transfer.user_id,'transfer_failed','Transfer failed and refunded',
      format('₦%s was returned to your wallet.',v_refund),false);
  ELSIF p_status = 'completed' AND v_fee > 0 AND coalesce(v_transfer.metadata ? 'pricing_reserved',false) THEN
    INSERT INTO public.platform_fee_ledger (transaction_id,source,amount)
    VALUES (v_transfer.id,'bank_transfer',v_fee) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.transactions SET status = p_status, metadata = coalesce(metadata,'{}'::jsonb) || coalesce(p_details,'{}'::jsonb),
    updated_at = now() WHERE id = v_transfer.id;
  RETURN jsonb_build_object('found',true,'status',p_status);
END;
$$;

ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS fee_amount numeric(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS fee_percent numeric(5,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.group_withdrawal_fee(p_group_id uuid, p_amount numeric)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT jsonb_build_object('percent', q.percent, 'fee', least(round(p_amount * q.percent / 100,2), greatest(p_amount - 0.01,0)),
    'charity', q.charity)
  FROM (
    SELECT coalesce(lower(g.category) = 'charity', false) AS charity,
      CASE WHEN lower(g.category) = 'charity' THEN 0 ELSE p.group_withdrawal_percent END AS percent
    FROM public.contribution_groups g CROSS JOIN public.platform_pricing p WHERE g.id = p_group_id AND p.singleton
  ) q;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_group_withdrawal_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_fee jsonb;
BEGIN
  v_fee := public.group_withdrawal_fee(NEW.contribution_id, NEW.amount);
  NEW.fee_amount := (v_fee->>'fee')::numeric;
  NEW.fee_percent := (v_fee->>'percent')::numeric;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS snapshot_group_withdrawal_fee ON public.withdrawal_requests;
CREATE TRIGGER snapshot_group_withdrawal_fee BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.snapshot_group_withdrawal_fee();

-- Existing clients cannot alter the amount, fee, or approval state of a request directly.
-- The existing PIN and voting functions perform those writes as the database owner.
REVOKE INSERT, UPDATE ON public.withdrawal_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_priced_withdrawal_request(
  p_group_id uuid, p_amount numeric, p_purpose text, p_pin text, p_expected_fee numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric IS DISTINCT FROM p_expected_fee THEN
    RAISE EXCEPTION 'The withdrawal fee changed. Reopen the withdrawal to review the updated amount.';
  END IF;
  RETURN public.create_withdrawal_request_safe(p_group_id,p_amount,p_purpose,p_pin)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_priced_instant_withdrawal(
  p_group_id uuid, p_amount numeric, p_purpose text, p_pin text, p_expected_fee numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_amount IS NULL OR p_amount < 0.01 OR p_amount <> round(p_amount,2) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.contribution_groups WHERE id = p_group_id FOR UPDATE;
  IF (public.group_withdrawal_fee(p_group_id,p_amount)->>'fee')::numeric IS DISTINCT FROM p_expected_fee THEN
    RAISE EXCEPTION 'The withdrawal fee changed. Reopen the withdrawal to review the updated amount.';
  END IF;
  PERFORM public.process_instant_withdrawal(p_group_id,auth.uid(),p_amount,p_purpose,p_pin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_transfer_allowance(uuid,timestamptz), public.group_withdrawal_fee(uuid,numeric),
  public.service_reserve_priced_transfer(uuid,text,numeric,numeric,jsonb), public.service_settle_priced_transfer(text,text,jsonb),
  public.snapshot_group_withdrawal_fee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_reserve_priced_transfer(uuid,text,numeric,numeric,jsonb),
  public.service_settle_priced_transfer(text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_platform_pricing(), public.get_wallet_transfer_allowance(),
  public.admin_platform_pricing_report(), public.admin_update_platform_pricing(integer,boolean,numeric),
  public.create_priced_withdrawal_request(uuid,numeric,text,text,numeric),
  public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_pricing(), public.get_wallet_transfer_allowance(),
  public.admin_platform_pricing_report(), public.admin_update_platform_pricing(integer,boolean,numeric),
  public.create_priced_withdrawal_request(uuid,numeric,text,text,numeric),
  public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric) TO authenticated;

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

  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Withdrawal recipient not found'); END IF;
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
    'withdrawal',
    'Withdrawal Approved & Credited',
    format('NGN %s from "%s" was approved by voters and credited to your wallet.',
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
  v_stored_pin text;
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

  SELECT id, wallet_balance, status, preferences INTO v_admin
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  IF COALESCE(v_admin.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Your account is currently % and cannot withdraw funds', v_admin.status;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_stored_pin := COALESCE(v_admin.preferences, '{}'::jsonb)->>'transactionPin';
    IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Please set a 4-digit Transaction PIN to authorize withdrawals';
    END IF;
    IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
      RAISE EXCEPTION 'Incorrect 4-digit Transaction PIN';
    END IF;
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
    'withdrawal',
    'Withdrawal Credited',
    format('₦%s withdrawn from "%s" and added to your wallet.', to_char(v_net, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_approved_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_instant_withdrawal(uuid,uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_withdrawal_request_safe(uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.process_instant_withdrawal(uuid,uuid,numeric,text);

CREATE OR REPLACE FUNCTION public.guard_transfer_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF (TG_OP <> 'INSERT' AND OLD.type = 'transfer') OR (TG_OP <> 'DELETE' AND NEW.type = 'transfer') THEN
      RAISE EXCEPTION 'Bank transfer ledger entries are managed by the payment service';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_transfer_ledger ON public.transactions;
CREATE TRIGGER guard_transfer_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_ledger();

COMMIT;
