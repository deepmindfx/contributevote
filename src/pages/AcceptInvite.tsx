import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GroupJoinPreview } from "@/components/contribution/GroupJoinPreview";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { InvitationService } from "@/services/supabase/invitationService";
import type { InvitationPreview } from "@/services/supabase/invitationService";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError("");
    setInvitation(null);
    void InvitationService.getInvitationByToken(token).then(
      (result) => { if (active) setInvitation(result); },
      (error) => { if (active) setError(error instanceof Error ? error.message : "Couldn’t load this invitation."); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, isAuthenticated]);

  const accept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    setError("");
    try {
      const groupId = await InvitationService.acceptInvitation(token);
      await refreshContributionData(true);
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t accept this invitation. Try again.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <GroupJoinPreview group={invitation?.group} loading={loading} error={error} inviter={invitation?.inviter.name}>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      {invitation?.status === "accepted" ? (
        <Link to={`/groups/${invitation.group_id}`} className="cb-btn cb-btn--primary w-full">
          Open Group Pool
        </Link>
      ) : isAuthenticated ? (
        <button
          type="button"
          onClick={accept}
          disabled={accepting}
          className="cb-btn cb-btn--primary w-full disabled:opacity-50"
        >
          {accepting ? "Joining…" : "Accept Invitation"}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[#64717d]">
            Sign in with the email address that received this invitation.
          </p>
          <Link
            to={`/auth?redirect=${encodeURIComponent("/invite/" + token)}`}
            className="cb-btn cb-btn--primary w-full"
          >
            Sign in to Accept Invite
          </Link>
        </div>
      )}
    </GroupJoinPreview>
  );
}
