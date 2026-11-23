import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GroupJoinPreview } from "@/components/contribution/GroupJoinPreview";
import { GroupJoinService } from "@/services/supabase/groupJoinService";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
type Group = Awaited<ReturnType<typeof GroupJoinService.getPublicGroupInfo>>;

export default function JoinGroup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [loaded, setLoaded] = useState<{ key: string; group: Group; failed?: boolean }>();
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([id, retry]);
  const current = loaded?.key === key ? loaded : undefined;
  const group = current?.group;
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setError("");
    void GroupJoinService.getPublicGroupInfo(id).then(
      (group) => { if (active) setLoaded({ key, group }); },
      () => { if (active) setLoaded({ key, group: null, failed: true }); },
    );
    return () => { active = false; };
  }, [id, key]);

  const join = async () => {
    if (!group || !user || joining) return;
    setJoining(true);
    setError("");
    try {
      const result = await GroupJoinService.joinGroup(user.id, group.id);
      if (result.success) {
        await refreshContributionData(true);
        navigate(`/groups/${group.id}`, { replace: true });
      } else {
        setError(result.error || "Couldn’t join this group. Try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <GroupJoinPreview group={group} loading={!current && Boolean(id)}
      error={current?.failed ? "We couldn’t load this group. Try again." : "This group is unavailable for public joining."}
      onRetry={current?.failed ? () => setRetry((value) => value + 1) : undefined}>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {isAuthenticated ? (
        <Button onClick={join} disabled={joining} className="h-11 w-full">{joining ? "Joining…" : "Join group"}</Button>
      ) : (
        <Button asChild className="h-11 w-full"><Link to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`}>Sign in to join</Link></Button>
      )}
    </GroupJoinPreview>
  );
}
