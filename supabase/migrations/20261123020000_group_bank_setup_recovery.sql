BEGIN;

-- Reserve a single provider request per group. An uncertain provider response
-- keeps the original reservation. A confirmed account can be linked on retry.
CREATE TABLE public.group_bank_account_setups (
  group_id uuid PRIMARY KEY REFERENCES public.contribution_groups(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  provider_account jsonb
);
ALTER TABLE public.group_bank_account_setups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_bank_account_setups FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT, DELETE ON public.group_bank_account_setups TO service_role;
GRANT UPDATE (provider_account) ON public.group_bank_account_setups TO service_role;

CREATE FUNCTION public.service_claim_group_bank_setup(p_user_id uuid,p_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_group public.contribution_groups%ROWTYPE;
  v_setup public.group_bank_account_setups%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.contribution_groups WHERE id=p_group_id AND creator_id=p_user_id
    AND coalesce(status,'active')='active' AND NOT coalesce(archived,false) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active owned group is required'; END IF;
  IF coalesce(v_group.account_number,'') ~ '^[0-9]{10}$' THEN
    RETURN jsonb_build_object('account',coalesce(v_group.account_details,'{}'::jsonb) || jsonb_build_object(
      'account_number',v_group.account_number,'bank_name',v_group.bank_name,'order_ref',v_group.account_reference));
  END IF;

  INSERT INTO public.group_bank_account_setups(group_id) VALUES (p_group_id) ON CONFLICT DO NOTHING
    RETURNING * INTO v_setup;
  IF FOUND THEN RETURN jsonb_build_object('attempt_id',v_setup.attempt_id); END IF;
  SELECT * INTO v_setup FROM public.group_bank_account_setups WHERE group_id=p_group_id;
  RETURN jsonb_build_object('provider_account',v_setup.provider_account);
END;
$$;
REVOKE ALL ON FUNCTION public.service_claim_group_bank_setup(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.service_claim_group_bank_setup(uuid,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
