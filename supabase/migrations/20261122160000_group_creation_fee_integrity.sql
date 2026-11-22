BEGIN;

-- Only approved server functions may insert groups or change an account's quota.
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.contribution_groups;
REVOKE INSERT ON public.contribution_groups FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.guard_group_creation_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.groups_created_count IS DISTINCT FROM 0 OR NEW.groups_created_free_remaining IS DISTINCT FROM 3 THEN
      RAISE EXCEPTION 'Invalid initial group creation quota';
    END IF;
  ELSIF NEW.groups_created_count IS DISTINCT FROM OLD.groups_created_count
     OR NEW.groups_created_free_remaining IS DISTINCT FROM OLD.groups_created_free_remaining THEN
    RAISE EXCEPTION 'Group creation quota is managed by CollectiPay';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_group_creation_counters() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_group_creation_counters BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_group_creation_counters();

-- Count existing groups, including archived groups, without restoring used slots or collecting past fees.
WITH owned AS (
  SELECT creator_id, count(*)::integer AS group_count
  FROM public.contribution_groups GROUP BY creator_id
), used AS (
  SELECT p.id, greatest(coalesce(p.groups_created_count,0), coalesce(o.group_count,0),
    3 - least(3,greatest(coalesce(p.groups_created_free_remaining,3),0))) AS creations
  FROM public.profiles p LEFT JOIN owned o ON o.creator_id=p.id
)
UPDATE public.profiles p SET groups_created_count=u.creations,
  groups_created_free_remaining=greatest(3-u.creations,0), updated_at=now()
FROM used u WHERE p.id=u.id AND (p.groups_created_count,p.groups_created_free_remaining)
  IS DISTINCT FROM (u.creations,greatest(3-u.creations,0));

ALTER TABLE public.platform_fee_ledger DROP CONSTRAINT platform_fee_ledger_source_check,
  ADD CONSTRAINT platform_fee_ledger_source_check CHECK (source IN ('bank_transfer','group_withdrawal','group_creation'));

-- Count only matching historical debits with a recorded before/after wallet snapshot.
INSERT INTO public.platform_fee_ledger(transaction_id,source,amount,earned_at)
SELECT id,'group_creation',amount,created_at FROM public.transactions
WHERE type='withdrawal' AND status='completed' AND payment_method='wallet' AND contribution_id IS NULL
  AND created_at IS NOT NULL AND amount=500 AND balance_before - balance_after=amount
  AND description LIKE 'Group creation fee for: %'
  AND reference_id ~ '^GROUP_FEE_[0-9a-f-]+_[0-9]+([.][0-9]+)?$'
ON CONFLICT (transaction_id) DO NOTHING;

CREATE TABLE public.group_creation_requests (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash bytea NOT NULL,
  result json NOT NULL,
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.group_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_creation_requests FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.check_group_creation_eligibility(uuid) RENAME TO group_creation_eligibility_internal;
REVOKE ALL ON FUNCTION public.group_creation_eligibility_internal(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.check_group_creation_eligibility(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sign in to check your group creation quota' USING ERRCODE='42501';
  END IF;
  RETURN public.group_creation_eligibility_internal(p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.check_group_creation_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_group_creation_eligibility(uuid) TO authenticated;

-- Older installs may still have earlier overloads with different checks.
DROP FUNCTION IF EXISTS public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text);
DROP FUNCTION IF EXISTS public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text,boolean);
DROP FUNCTION IF EXISTS public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text,boolean,numeric,timestamptz,timestamptz,numeric);
ALTER FUNCTION public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text,boolean,numeric,timestamptz,timestamptz,numeric,text)
  RENAME TO create_group_with_fee_internal;
REVOKE ALL ON FUNCTION public.create_group_with_fee_internal(uuid,text,text,numeric,text,text,text,boolean,numeric,timestamptz,timestamptz,numeric,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_group_with_fee_check(
  p_user_id uuid, p_name text, p_description text, p_target_amount numeric, p_category text, p_frequency text,
  p_privacy text DEFAULT 'public', p_enable_voting_rights boolean DEFAULT true, p_contribution_amount numeric DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL, p_voting_threshold numeric DEFAULT 60,
  p_cover_image_url text DEFAULT NULL, p_expected_fee numeric DEFAULT 0, p_request_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_expected_fee numeric;
  v_free_remaining integer;
  v_payload_hash bytea;
  v_request public.group_creation_requests%ROWTYPE;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sign in to create a group for your account' USING ERRCODE='42501';
  END IF;

  -- Serialize quota reads, consent checks and retries on the same wallet lock used by the debit.
  SELECT groups_created_free_remaining INTO v_free_remaining
  FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Your account profile is unavailable.'); END IF;
  v_expected_fee := CASE WHEN v_free_remaining > 0 THEN 0 ELSE 500 END;

  v_payload_hash := sha256(convert_to(jsonb_build_array(p_name,p_description,p_target_amount,p_category,p_frequency,p_privacy,
    p_enable_voting_rights,p_contribution_amount,p_start_date,p_end_date,p_voting_threshold,p_cover_image_url,p_expected_fee)::text,'UTF8'));
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_request FROM public.group_creation_requests WHERE user_id=p_user_id AND request_id=p_request_id;
    IF FOUND THEN
      IF v_request.payload_hash IS DISTINCT FROM v_payload_hash THEN
        RETURN json_build_object('success',false,'error','This request was already used for a different group.');
      END IF;
      RETURN v_request.result;
    END IF;
  END IF;

  IF p_expected_fee IS DISTINCT FROM v_expected_fee OR (v_expected_fee > 0 AND p_request_id IS NULL) THEN
    RETURN json_build_object('success',false,'code','GROUP_CREATION_FEE_CHANGED','required_amount',v_expected_fee,
      'free_remaining',v_free_remaining,'message','Review the current group creation fee before continuing.');
  END IF;

  v_result := public.create_group_with_fee_internal(p_user_id,p_name,p_description,p_target_amount,p_category,
    p_frequency,p_privacy,p_enable_voting_rights,p_contribution_amount,p_start_date,p_end_date,p_voting_threshold,p_cover_image_url);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_result; END IF;

  IF v_expected_fee > 0 THEN
    INSERT INTO public.platform_fee_ledger(transaction_id,source,amount)
    VALUES ((v_result->>'transaction_id')::uuid,'group_creation',v_expected_fee);
  END IF;
  IF p_request_id IS NOT NULL THEN
    INSERT INTO public.group_creation_requests(user_id,request_id,payload_hash,result)
    VALUES (p_user_id,p_request_id,v_payload_hash,v_result);
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text,boolean,numeric,timestamptz,timestamptz,numeric,text,numeric,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_fee_check(uuid,text,text,numeric,text,text,text,boolean,numeric,timestamptz,timestamptz,numeric,text,numeric,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_pricing_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_revenue jsonb;
  v_recent_creation_fees jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND status='active') THEN
    RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'bank_transfer', coalesce(sum(amount) FILTER (WHERE source='bank_transfer'),0),
    'group_withdrawal', coalesce(sum(amount) FILTER (WHERE source='group_withdrawal'),0),
    'group_creation', coalesce(sum(amount) FILTER (WHERE source='group_creation'),0),
    'group_creation_count', count(*) FILTER (WHERE source='group_creation'),
    'last_30_days', coalesce(sum(amount) FILTER (WHERE earned_at>=now()-interval '30 days'),0),
    'total', coalesce(sum(amount),0)
  ) INTO v_revenue FROM public.platform_fee_ledger;

  SELECT coalesce(jsonb_agg(to_jsonb(fees) ORDER BY earned_at DESC,transaction_id DESC),'[]'::jsonb)
  INTO v_recent_creation_fees FROM (
    SELECT l.transaction_id, l.amount, l.earned_at, substr(t.description,length('Group creation fee for: ')+1) AS group_name
    FROM public.platform_fee_ledger l JOIN public.transactions t ON t.id=l.transaction_id
    WHERE l.source='group_creation' ORDER BY l.earned_at DESC,l.transaction_id DESC LIMIT 10
  ) fees;
  RETURN jsonb_build_object('pricing',public.get_platform_pricing(),'revenue',v_revenue,
    'recent_group_creation_fees',v_recent_creation_fees);
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
