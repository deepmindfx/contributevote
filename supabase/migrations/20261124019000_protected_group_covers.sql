BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('protected-group-covers','protected-group-covers',false,5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']);

CREATE UNIQUE INDEX group_cover_single_assignment ON public.contribution_groups(cover_image_url)
  WHERE cover_image_url LIKE 'protected-group-covers:%';

CREATE POLICY "Readers can download covers of visible groups" ON storage.objects
  FOR SELECT TO anon,authenticated USING (
    bucket_id='protected-group-covers' AND EXISTS (
      SELECT FROM public.contribution_groups g
      WHERE g.cover_image_url='protected-group-covers:'||storage.objects.name AND public.can_view_group(g.id)
    )
  );

CREATE POLICY "Group organizers can upload covers to their own folder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='protected-group-covers'
    AND split_part(name,'/',1)=auth.uid()::text
    AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|jpeg|png|webp|gif)$'
  );

CREATE POLICY "Group organizers can remove unused cover uploads" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='protected-group-covers' AND split_part(name,'/',1)=auth.uid()::text AND NOT EXISTS (
      SELECT FROM public.contribution_groups g WHERE g.cover_image_url='protected-group-covers:'||storage.objects.name
    )
  );

-- A legacy CDN URL could have been cached publicly. Remove it from any private group.
UPDATE public.contribution_groups SET cover_image_url=NULL
  WHERE privacy IS DISTINCT FROM 'public' AND cover_image_url IS NOT NULL
    AND cover_image_url NOT LIKE 'protected-group-covers:%';

CREATE FUNCTION public.guard_group_cover_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_path text;
BEGIN
  IF NEW.cover_image_url IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.cover_image_url IS NOT DISTINCT FROM OLD.cover_image_url
    AND NEW.creator_id IS NOT DISTINCT FROM OLD.creator_id THEN
    IF NEW.privacy IS DISTINCT FROM 'public' AND NEW.cover_image_url NOT LIKE 'protected-group-covers:%' THEN
      NEW.cover_image_url:=NULL;
    END IF;
    RETURN NEW;
  END IF;

  v_path:=substr(NEW.cover_image_url,length('protected-group-covers:')+1);
  IF NEW.cover_image_url NOT LIKE 'protected-group-covers:%'
    OR split_part(v_path,'/',1) IS DISTINCT FROM NEW.creator_id::text
    OR v_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|jpeg|png|webp|gif)$'
    OR NOT EXISTS (SELECT FROM storage.objects WHERE bucket_id='protected-group-covers' AND name=v_path)
  THEN
    RAISE EXCEPTION 'Upload the group photo again to attach it securely.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_group_cover_assignment
  BEFORE INSERT OR UPDATE OF cover_image_url,privacy,creator_id ON public.contribution_groups
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_cover_assignment();
REVOKE ALL ON FUNCTION public.guard_group_cover_assignment() FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS "Authenticated users upload own group covers" ON storage.objects;
DROP POLICY IF EXISTS "Users update own group covers" ON storage.objects;

NOTIFY pgrst,'reload schema';
COMMIT;
