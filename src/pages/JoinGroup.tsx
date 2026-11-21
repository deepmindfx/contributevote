import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GroupJoinPreview } from "@/components/contribution/GroupJoinPreview";
import { GroupJoinService } from "@/services/supabase/groupJoinService";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["contribution_groups"]["Row"];

export default function JoinGroup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError("");
    void GroupJoinService.getPublicGroupInfo(id).then((result) => {
      if (active) {
        setGroup(result);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [id]);

  const join = async () => {
    if (!id || !user || joining) return;
    setJoining(true);
    setError("");
    try {
      const result = await GroupJoinService.joinGroup(user.id, id);
      if (result.success) {
        void refreshContributionData();
        navigate(`/groups/${id}`, { replace: true });
      } else {
        setError(result.error || "Couldn’t join this group. Try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <GroupJoinPreview group={group} loading={loading} error="This group is unavailable for public joining.">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {isAuthenticated ? (
        <Button onClick={join} disabled={joining} className="h-11 w-full">{joining ? "Joining…" : "Join group"}</Button>
      ) : (
        <Button asChild className="h-11 w-full"><Link to={`/auth?redirect=${encodeURIComponent("/join/" + id)}`}>Sign in to join</Link></Button>
      )}
    </GroupJoinPreview>
  );
}
