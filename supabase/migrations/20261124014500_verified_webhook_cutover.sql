BEGIN;

-- Deploy the verified webhook before removing its previous service-only entry point.
REVOKE ALL ON FUNCTION public.service_record_outside_group_payment(uuid,text,numeric,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
