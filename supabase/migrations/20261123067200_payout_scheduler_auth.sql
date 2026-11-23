BEGIN;

DO $token$
BEGIN
  IF NOT EXISTS (SELECT FROM vault.secrets WHERE name='collectipay_scheduler_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'collectipay_scheduler_token');
  END IF;
END
$token$;

CREATE FUNCTION public.is_collectipay_scheduler_request(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce((
    SELECT extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256')
    FROM vault.decrypted_secrets WHERE name='collectipay_scheduler_token' LIMIT 1
  ),false) WHERE p_token ~ '^[a-f0-9]{64}$';
$$;
REVOKE ALL ON FUNCTION public.is_collectipay_scheduler_request(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_collectipay_scheduler_request(text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
