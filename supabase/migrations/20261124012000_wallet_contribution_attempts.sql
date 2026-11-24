BEGIN;

CREATE TABLE public.wallet_contribution_attempts (
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  attempt_id uuid NOT NULL,
  group_id uuid NOT NULL,
  amount numeric NOT NULL,
  anonymous boolean NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,attempt_id)
);
ALTER TABLE public.wallet_contribution_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_contribution_attempts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.submit_wallet_contribution(p_group_id uuid,p_amount numeric,p_anonymous boolean,p_pin text,p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_attempt public.wallet_contribution_attempts%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR p_attempt_id IS NULL OR p_group_id IS NULL OR p_anonymous IS NULL
    OR p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 99999999.99 OR p_amount<>round(p_amount,2) THEN
    RETURN jsonb_build_object('success',false,'error','Review this contribution and try again.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wallet-contribution:' || v_user || ':' || p_attempt_id,0));
  SELECT * INTO v_attempt FROM public.wallet_contribution_attempts WHERE user_id=v_user AND attempt_id=p_attempt_id;
  IF FOUND THEN
    IF (v_attempt.group_id,v_attempt.amount,v_attempt.anonymous) IS DISTINCT FROM (p_group_id,p_amount,p_anonymous) THEN
      RETURN jsonb_build_object('success',false,'error','This confirmation belongs to another contribution.');
    END IF;
    RETURN v_attempt.result || jsonb_build_object('replayed',true);
  END IF;

  v_result:=public.contribute_from_wallet(v_user,p_group_id,p_amount,p_anonymous,p_pin)::jsonb;
  IF v_result->>'success'='true' THEN
    INSERT INTO public.wallet_contribution_attempts(user_id,attempt_id,group_id,amount,anonymous,result)
      VALUES(v_user,p_attempt_id,p_group_id,p_amount,p_anonymous,v_result);
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_wallet_contribution(uuid,numeric,boolean,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_wallet_contribution(uuid,numeric,boolean,text,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
