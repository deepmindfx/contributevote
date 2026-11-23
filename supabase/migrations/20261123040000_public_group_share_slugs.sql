BEGIN;

ALTER TABLE public.contribution_groups ADD COLUMN share_slug text;

-- Keep issued addresses reserved, including after a group is deleted.
CREATE TABLE public.group_share_slug_reservations (
  slug text PRIMARY KEY,
  group_id uuid NOT NULL
);
ALTER TABLE public.group_share_slug_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_share_slug_reservations FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.assign_group_share_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_base text;
  v_slug text;
  v_id text := replace(NEW.id::text, '-', '');
  v_suffix_length integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.share_slug IS NOT NULL THEN
    NEW.share_slug := OLD.share_slug;
    RETURN NEW;
  END IF;

  v_base := regexp_replace(normalize(coalesce(NEW.name, ''), NFKD), U&'[\0300-\036f]', '', 'g');
  v_base := lower(translate(v_base, 'ɓɗƙŋƁƊƘŊ', 'bdknbdkn'));
  v_base := trim(both '-' from left(regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'), 44));
  IF v_base = '' THEN v_base := 'group-' || left(v_id, 8); END IF;
  IF v_base ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN v_base := 'group-' || v_base; END IF;

  FOREACH v_suffix_length IN ARRAY ARRAY[0, 6, 10, 16, 32] LOOP
    v_slug := CASE WHEN v_suffix_length = 0 THEN v_base
      ELSE left(v_base, 44) || '-' || left(v_id, v_suffix_length) END;
    INSERT INTO public.group_share_slug_reservations(slug, group_id) VALUES (v_slug, NEW.id)
    ON CONFLICT (slug) DO NOTHING;
    IF FOUND THEN
      NEW.share_slug := v_slug;
      RETURN NEW;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not reserve a group address';
END;
$$;

REVOKE ALL ON FUNCTION public.assign_group_share_slug() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER assign_group_share_slug
  BEFORE INSERT OR UPDATE OF share_slug ON public.contribution_groups
  FOR EACH ROW EXECUTE FUNCTION public.assign_group_share_slug();

DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.contribution_groups WHERE share_slug IS NULL ORDER BY created_at, id LOOP
    UPDATE public.contribution_groups SET share_slug = NULL WHERE id = v_id;
  END LOOP;
END;
$$;

ALTER TABLE public.contribution_groups
  ALTER COLUMN share_slug SET DEFAULT '',
  ALTER COLUMN share_slug SET NOT NULL,
  ADD CONSTRAINT contribution_groups_share_slug_key UNIQUE (share_slug);

NOTIFY pgrst, 'reload schema';
COMMIT;
