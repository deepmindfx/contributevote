CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, name, phone, wallet_balance, role, status, preferences,
    groups_created_count, groups_created_free_remaining, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    coalesce(NEW.raw_user_meta_data->>'name', ''),
    coalesce(NEW.raw_user_meta_data->>'phone', ''),
    0, 'user', 'active',
    jsonb_build_object('darkMode', true, 'anonymousContributions', false, 'notificationsEnabled', true),
    0, 3, now(), now()
  );
  RETURN NEW;
END;
$$;
