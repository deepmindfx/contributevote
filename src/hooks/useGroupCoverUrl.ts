import { useEffect, useState } from "react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { downloadGroupCover, PROTECTED_GROUP_COVER_PREFIX } from "@/services/supabase/groupImageService";

export function useGroupCoverUrl(reference?: string | null) {
  const { user } = useSupabaseUser();
  const protectedCover = reference?.startsWith(PROTECTED_GROUP_COVER_PREFIX);
  const key = protectedCover ? `${user?.id ?? "guest"}:${reference}` : null;
  const [cover, setCover] = useState<{ key: string; url: string }>();

  useEffect(() => {
    if (!key || !reference) return;
    let mounted = true;
    let objectUrl: string | undefined;
    void downloadGroupCover(reference).then(({ data, error }) => {
      if (!mounted || error || !data) return;
      objectUrl = URL.createObjectURL(data);
      setCover({ key, url: objectUrl });
    }).catch(() => undefined);
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference, key]);

  if (protectedCover) return cover?.key === key ? cover.url : undefined;
  return reference ?? undefined;
}
