BEGIN;

-- Privileged records are changed through audited routines. The dashboard can still read its authorized rows.
DROP POLICY IF EXISTS "Admins read and write audit logs" ON public.admin_audit_logs;
CREATE POLICY "Active admins read audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.admin_audit_logs TO authenticated;

-- Gateway secret settings are only read by Edge Functions. The admin panel uses the masked settings RPC.
REVOKE ALL ON TABLE public.platform_payment_settings FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.guard_payment_callback_origins()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND
    (NEW.static_ip_proxy_url IS DISTINCT FROM OLD.static_ip_proxy_url OR (
      NEW.webhook_url IS DISTINCT FROM OLD.webhook_url AND NOT (
        OLD.webhook_url IS NULL
        AND NEW.webhook_url IS NOT DISTINCT FROM 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution'
      )
    )) THEN
    RAISE EXCEPTION 'Payment callback and relay URLs are managed by the deployment operator';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_payment_callback_origins BEFORE UPDATE OF static_ip_proxy_url,webhook_url
  ON public.platform_payment_settings FOR EACH ROW EXECUTE FUNCTION public.guard_payment_callback_origins();
REVOKE EXECUTE ON FUNCTION public.guard_payment_callback_origins() FROM PUBLIC,anon,authenticated;

-- The current app uses electorate snapshots and its own membership flag.
REVOKE ALL ON FUNCTION public.get_group_voters(uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.get_group_voters(uuid) SET search_path TO public,pg_temp;
ALTER FUNCTION public.lookup_user_id_by_email(text) SET search_path TO public,pg_temp;
ALTER FUNCTION public.expire_withdrawal_requests() SET search_path TO public,pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path TO '';
REVOKE EXECUTE ON FUNCTION public.expire_withdrawal_requests(),public.update_updated_at_column()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_withdrawal_requests() TO service_role;

-- Never allow a browser role to create a system notification or rewrite its content.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
REVOKE INSERT,UPDATE ON TABLE public.notifications FROM PUBLIC,anon,authenticated;
GRANT UPDATE(is_read) ON TABLE public.notifications TO authenticated;

-- Older admin functions retained PostgreSQL's default PUBLIC execute grant.
DO $$
DECLARE
  entry record;
BEGIN
  FOR entry IN
    SELECT p.oid::regprocedure AS signature,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS member_allowed,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_allowed
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,6)='admin_'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',entry.signature);
    IF entry.member_allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',entry.signature); END IF;
    IF entry.service_allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',entry.signature); END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_user_bvn(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_user_bvn(text) TO authenticated;

-- Quota shared by standalone account verification and bulk recipient quotes.
CREATE TABLE public.bank_lookup_quota (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 240)
);
ALTER TABLE public.bank_lookup_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bank_lookup_quota FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.service_claim_bank_lookup_quota(p_user_id uuid,p_count integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_used integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 100 THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=p_user_id AND coalesce(p.status,'active')='active' AND u.email_confirmed_at IS NOT NULL
  ) THEN RETURN false; END IF;

  INSERT INTO public.bank_lookup_quota AS q(user_id,window_start,attempts)
    VALUES(p_user_id,v_now,p_count)
    ON CONFLICT(user_id) DO UPDATE SET
      window_start=CASE WHEN q.window_start<=v_now-interval '15 minutes' THEN v_now ELSE q.window_start END,
      attempts=CASE WHEN q.window_start<=v_now-interval '15 minutes' THEN p_count ELSE q.attempts+p_count END
    WHERE q.window_start<=v_now-interval '15 minutes' OR q.attempts+p_count<=240
    RETURNING attempts INTO v_used;
  RETURN v_used IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.service_claim_bank_lookup_quota(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_claim_bank_lookup_quota(uuid,integer) TO service_role;

-- Public cover delivery continues to work through the existing public bucket URL.
-- Folder listing is limited to the uploader and platform administrators.
DROP POLICY IF EXISTS "Public read group covers" ON storage.objects;
CREATE POLICY "Owners can list their group cover files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='group-covers' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));

NOTIFY pgrst,'reload schema';
COMMIT;
