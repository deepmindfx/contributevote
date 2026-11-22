import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Vote,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CountdownTimer from "@/components/ui/countdown-timer";
import BrandLoader from "@/components/ui/BrandLoader";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import {
  getWithdrawalRequests,
  voteOnWithdrawal,
  type WithdrawalRequest,
} from "@/services/supabase/withdrawalService";
import { cn } from "@/lib/utils";

interface GroupWithdrawalVotesCardProps {
  groupId: string;
  votingThreshold?: number | null;
  hasVotingRights: boolean;
  onVoteComplete?: () => Promise<void> | void;
}

export function GroupWithdrawalVotesCard({
  groupId,
  votingThreshold,
  hasVotingRights,
  onVoteComplete,
}: GroupWithdrawalVotesCardProps) {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [eligibleVoters, setEligibleVoters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  const approvalThreshold =
    votingThreshold && votingThreshold >= 50 && votingThreshold <= 100
      ? Math.round(votingThreshold)
      : 60;

  const loadData = useCallback(async () => {
    try {
      const [reqs, votersRes] = await Promise.all([
        getWithdrawalRequests(groupId),
        supabase
          .from("contributors")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("has_voting_rights", true)
          .not("user_id", "is", null),
      ]);
      setRequests(reqs);
      setEligibleVoters(votersRes.count || 0);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadData();

    const channel = supabase
      .channel(`group_withdrawal_votes_${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawal_requests",
          filter: `contribution_id=eq.${groupId}`,
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, loadData]);

  const handleVote = async (withdrawalId: string, approve: boolean) => {
    if (!user) {
      toast.error("Please sign in to vote");
      return;
    }
    setVotingId(withdrawalId);
    try {
      const res = await voteOnWithdrawal(withdrawalId, approve);
      if (!res.success) {
        toast.error(res.error || "Could not record vote");
        return;
      }

      const st = res.votingStatus;
      if (st?.status === "executed" || st?.status === "approved") {
        toast.success(
          `Payout approved (${st.participation_rate}% participated · ${st.approval_rate}% yes). Funds credited to requester wallet.`
        );
      } else if (st?.status === "rejected") {
        toast.error(
          `Withdrawal rejected — did not meet the ${st.voting_threshold || approvalThreshold}% approval threshold.`
        );
      } else if (st) {
        toast.success(
          `Vote recorded · ${st.participation_rate}% participation, ${st.approval_rate}% approval`
        );
      } else {
        toast.success("Vote recorded");
      }

      await Promise.allSettled([loadData(), refreshCurrentUser(), onVoteComplete?.()]);
    } finally {
      setVotingId(null);
    }
  };

  // Show pending proposals plus recently decided ones (last 2)
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const recentResolved = requests.filter((r) => r.status !== "pending").slice(0, 2);
  const visibleRequests = pendingRequests.length > 0 ? pendingRequests : recentResolved;

  if (loading || visibleRequests.length === 0) return null;

  return (
    <>
      {votingId && (
        <BrandLoader
          variant="overlay"
          badge="Governance Vote"
          message="Recording your vote"
          submessage="Updating group payout consensus…"
        />
      )}

      <section className="cp-card-native overflow-hidden" aria-label="Group withdrawal votes">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-accent/40 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Vote className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {pendingRequests.length > 0
                  ? `${pendingRequests.length} Active Withdrawal Vote${pendingRequests.length === 1 ? "" : "s"}`
                  : "Recent Payout Decisions"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                At least 70% must vote &amp; {approvalThreshold}% must say yes
              </p>
            </div>
          </div>
          <Link
            to="/votes"
            className="text-xs font-bold text-primary hover:underline"
          >
            All votes →
          </Link>
        </div>

        <div className="divide-y divide-border/70">
          {visibleRequests.map((req) => {
            const votes = Array.isArray(req.votes) ? req.votes : [];
            const yesVotes = votes.filter((v) => v.vote === true).length;
            const noVotes = votes.filter((v) => v.vote === false).length;
            const votesCast = votes.length;
            const participationPct =
              eligibleVoters > 0 ? Math.min(100, (votesCast / eligibleVoters) * 100) : 0;
            const approvalPct = votesCast > 0 ? (yesVotes / votesCast) * 100 : 0;
            const userVoteObj = user ? votes.find((v) => v.user_id === user.id) : undefined;
            const isPending = req.status === "pending";

            return (
              <div key={req.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                          isPending
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : req.status === "executed" || req.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-destructive/12 text-destructive"
                        )}
                      >
                        {isPending ? (
                          <Clock className="h-3 w-3" />
                        ) : req.status === "executed" || req.status === "approved" ? (
                          <Wallet className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {req.status === "executed" ? "Approved & Paid" : req.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                      ₦{Number(req.amount || 0).toLocaleString("en-NG")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{req.purpose}</p>
                  </div>

                  {isPending && req.deadline && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1.5">
                      <CountdownTimer deadline={req.deadline} size="sm" showLabel={true} />
                    </div>
                  )}
                </div>

                {/* Participation & Approval Meters */}
                <div className="grid gap-3 rounded-2xl border bg-muted/25 p-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                        <BarChart3 className="h-3.5 w-3.5 text-primary" />
                        Participation ({votesCast}/{eligibleVoters})
                      </span>
                      <span className="font-bold tabular-nums text-foreground">
                        {Math.round(participationPct)}% / 70%
                      </span>
                    </div>
                    <Progress value={participationPct} className="h-1.5" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Approval ({yesVotes} yes · {noVotes} no)
                      </span>
                      <span className="font-bold tabular-nums text-foreground">
                        {Math.round(approvalPct)}% / {approvalThreshold}%
                      </span>
                    </div>
                    <Progress value={approvalPct} className="h-1.5" />
                  </div>
                </div>

                {/* Voting Controls */}
                {isPending && (
                  hasVotingRights ? (
                    userVoteObj ? (
                      <div
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold",
                          userVoteObj.vote
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        )}
                      >
                        {userVoteObj.vote ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            You voted to Approve this withdrawal
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            You voted to Reject this withdrawal
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button
                          type="button"
                          onClick={() => handleVote(req.id, true)}
                          disabled={votingId === req.id}
                          className="h-11 gap-1.5 rounded-xl font-bold"
                        >
                          <ThumbsUp className="h-4 w-4" />
                          Approve Payout
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleVote(req.id, false)}
                          disabled={votingId === req.id}
                          className="h-11 gap-1.5 rounded-xl border-destructive/35 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <ThumbsDown className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-center text-xs font-medium text-amber-800 dark:text-amber-300">
                      Contribute from your wallet (or have your bank transfer verified) to vote on payouts.
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
