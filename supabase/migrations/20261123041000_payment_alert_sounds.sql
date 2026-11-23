BEGIN;

CREATE TABLE public.payment_alert_sounds (
  kind text PRIMARY KEY CHECK (kind IN ('wallet', 'group')),
  object_path text CHECK (object_path IS NULL OR object_path ~ ('^' || kind || '/[0-9a-f-]{36}\.mp3$')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_alert_sounds (kind) VALUES ('wallet'), ('group');
ALTER TABLE public.payment_alert_sounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_alert_sounds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_alert_sounds TO authenticated;
CREATE POLICY "Signed in users read payment sounds" ON public.payment_alert_sounds FOR SELECT TO authenticated USING (true);

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-alert-sounds', 'payment-alert-sounds', true, 2097152, ARRAY['audio/mpeg']);

CREATE POLICY "Admins upload payment sounds" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-alert-sounds' AND name ~ '^(wallet|group)/[0-9a-f-]{36}\.mp3$'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND coalesce(status, 'active') = 'active')
);
CREATE POLICY "Admins read payment sound objects" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-alert-sounds'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND coalesce(status, 'active') = 'active')
);
CREATE POLICY "Admins remove unused payment sounds" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-alert-sounds'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND coalesce(status, 'active') = 'active')
  AND NOT EXISTS (SELECT 1 FROM public.payment_alert_sounds WHERE object_path = storage.objects.name)
);

CREATE FUNCTION public.admin_set_payment_alert_sound(p_kind text, p_object_path text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_previous text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin AND role = 'admin' AND coalesce(status, 'active') = 'active') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT object_path INTO v_previous FROM public.payment_alert_sounds WHERE kind = p_kind FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown payment sound'; END IF;
  IF p_object_path IS NOT NULL AND (
    p_object_path !~ ('^' || p_kind || '/[0-9a-f-]{36}\.mp3$') OR
    NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-alert-sounds' AND name = p_object_path)
  ) THEN
    RAISE EXCEPTION 'Upload an MP3 for this payment sound first';
  END IF;

  UPDATE public.payment_alert_sounds SET object_path = p_object_path, updated_at = clock_timestamp() WHERE kind = p_kind;
  INSERT INTO public.admin_audit_logs(admin_id, action, target_type, summary, metadata)
  VALUES (v_admin, 'payment_alert_sound_updated', 'system', 'Updated payment alert sound',
    jsonb_build_object('kind', p_kind, 'default', p_object_path IS NULL));
  RETURN v_previous;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_payment_alert_sound(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_alert_sound(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile_settings(p_user_id uuid, p_patch jsonb)
RETURNS public.profiles LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_profile public.profiles;
  v_preferences jsonb := coalesce(p_patch->'preferences', '{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the profile owner can update these settings' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR (p_patch - ARRAY['name','phone','preferences']) <> '{}'::jsonb
    OR jsonb_typeof(v_preferences) IS DISTINCT FROM 'object'
    OR (v_preferences - ARRAY['darkMode','anonymousContributions','notificationsEnabled','walletNotifications',
      'groupNotifications','paymentVibration','paymentSound','username','profileImage','savedBeneficiaries',
      'hiddenBeneficiaries','hiddenBeneficiaryTimestamps']) <> '{}'::jsonb
    OR (v_preferences ? 'paymentSound' AND jsonb_typeof(v_preferences->'paymentSound') <> 'boolean')
    OR (p_patch ? 'name' AND jsonb_typeof(p_patch->'name') <> 'string')
    OR (p_patch ? 'phone' AND jsonb_typeof(p_patch->'phone') NOT IN ('string','null')) THEN
    RAISE EXCEPTION 'Invalid profile settings' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET name = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE name END,
    phone = CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE phone END,
    preferences = coalesce(preferences, '{}'::jsonb) || v_preferences,
    updated_at = clock_timestamp()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_profile;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_alert_sounds;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
