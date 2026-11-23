BEGIN;

CREATE FUNCTION public.update_my_profile_settings(p_user_id uuid, p_patch jsonb)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
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
      'groupNotifications','paymentVibration','username','profileImage','savedBeneficiaries','hiddenBeneficiaries',
      'hiddenBeneficiaryTimestamps']) <> '{}'::jsonb
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

REVOKE ALL ON FUNCTION public.update_my_profile_settings(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile_settings(uuid,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
