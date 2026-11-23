BEGIN;

CREATE TABLE public.group_withdrawal_attempts (
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  group_id uuid NOT NULL,
  amount numeric NOT NULL,
  purpose text NOT NULL,
  expected_fee numeric NOT NULL,
  instant boolean NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,attempt_id)
);
ALTER TABLE public.group_withdrawal_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_withdrawal_attempts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.submit_group_withdrawal(
  p_group_id uuid,p_amount numeric,p_purpose text,p_pin text,p_expected_fee numeric,p_attempt_id uuid,p_instant boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_purpose text := trim(p_purpose);
  v_attempt public.group_withdrawal_attempts%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
  IF p_attempt_id IS NULL OR p_group_id IS NULL OR p_instant IS NULL OR p_expected_fee IS NULL
    OR p_amount IS NULL OR p_amount<0.01 OR p_amount<>round(p_amount,2)
    OR char_length(coalesce(v_purpose,'')) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Review the withdrawal details';
  END IF;
  PERFORM 1 FROM public.platform_pricing WHERE singleton FOR SHARE;
  PERFORM 1 FROM public.profiles WHERE id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  SELECT * INTO v_attempt FROM public.group_withdrawal_attempts WHERE user_id=v_user AND attempt_id=p_attempt_id;
  IF FOUND THEN
    IF (v_attempt.group_id,v_attempt.amount,v_attempt.purpose,v_attempt.expected_fee,v_attempt.instant)
      IS DISTINCT FROM (p_group_id,p_amount,v_purpose,p_expected_fee,p_instant) THEN
      RAISE EXCEPTION 'This withdrawal confirmation belongs to different payment details';
    END IF;
    RETURN v_attempt.result;
  END IF;

  IF p_instant THEN
    v_result := public.process_priced_instant_withdrawal(p_group_id,p_amount,v_purpose,p_pin,p_expected_fee)::jsonb;
  ELSE
    v_result := public.create_priced_withdrawal_request(p_group_id,p_amount,v_purpose,p_pin,p_expected_fee);
  END IF;
  IF (v_result->>'success')::boolean IS TRUE THEN
    INSERT INTO public.group_withdrawal_attempts
      (user_id,attempt_id,group_id,amount,purpose,expected_fee,instant,result)
    VALUES (v_user,p_attempt_id,p_group_id,p_amount,v_purpose,p_expected_fee,p_instant,v_result);
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_group_withdrawal(uuid,numeric,text,text,numeric,uuid,boolean),
  public.create_priced_withdrawal_request(uuid,numeric,text,text,numeric),
  public.process_priced_instant_withdrawal(uuid,numeric,text,text,numeric),
  public.create_withdrawal_request_safe(uuid,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_group_withdrawal(uuid,numeric,text,text,numeric,uuid,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
