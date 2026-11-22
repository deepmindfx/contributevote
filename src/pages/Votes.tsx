import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  Wallet,
  XCircle,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import Header from "@/components/layout/Header";
import BrandLoader from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CountdownTimer from "@/components/ui/countdown-timer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { voteOnWithdrawal } from "@/services/supabase/withdrawalService";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 6;

const VotesPage = () => {
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { contributions, withdrawalRequests, refreshContributionData } = useSupabaseContribution();
  const [voteRequests, setVoteRequests] = useState<any[]>([]);
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [historyPage, setHistoryPage] = useState(1);

  const buildVoteList = () => {
    const formatted = withdrawalRequests.map((request) => {
      const contribution: any = contributions.find((c) => c.id === request.contribution_id);
      const groupContributors = Array.isArray(contribution?.contributors)
        ? contribution.contributors
        : [];
      const userContributor = groupContributors.find((c: any) => c.user_id === user?.id);
      const hasVotingRights = Boolean(userContributor?.has_voting_rights === true);
      const eligibleVoters = groupContributors.filter(
        (c: any) => c.has_voting_rights === true && c.user_id
      ).length;

      const rawThreshold = Number(contribution?.voting_threshold || 60);
      const threshold =
        rawThreshold >= 50 && rawThreshold <= 100 ? Math.round(rawThreshold) : 60;

      const votesArray = Array.isArray(request.votes) ? (request.votes as any[]) : [];
      const userVoteData = votesArray.find((v: any) => v.user_id === user?.id);
      const hasVoted = Boolean(userVoteData);
      const userVote = userVoteData
        ? userVoteData.vote === true
          ? "approve"
          : "reject"
        : undefined;

      const totalVotes = votesArray.length;
      const approveVotes = votesArray.filter((v: any) => v.vote === true).length;
      const rejectVotes = votesArray.filter((v: any) => v.vote === false).length;
      const approvalRate = totalVotes > 0 ? (approveVotes / totalVotes) * 100 : 0;
      const rejectionRate = totalVotes > 0 ? (rejectVotes / totalVotes) * 100 : 0;
      const participationRate =
        eligibleVoters > 0 ? Math.min(100, (totalVotes / eligibleVoters) * 100) : 0;

      return {
        requestId: request.id,
        contributionId: request.contribution_id,
        contributionName: contribution ? contribution.name : "Group Pool",
        category: contribution?.category || "community",
        threshold,
        eligibleVoters,
        amount: Number(request.amount || 0),
        purpose: request.purpose || "No purpose specified",
        createdAt: request.created_at,
        deadline: request.deadline,
        hasContributed: hasVotingRights,
        hasVoted,
        userVote,
        votes: votesArray,
        status: request.status,
        stats: {
          totalVotes,
          approveVotes,
          rejectVotes,
          approvalRate,
          rejectionRate,
          participationRate,
        },
      };
    });

    setVoteRequests(formatted);
  };

  useEffect(() => {
    if (user && contributions && withdrawalRequests) {
      buildVoteList();
    }
  }, [user, contributions, withdrawalRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return isValid(date) ? format(date, "MMM d, yyyy · h:mm a") : "";
  };

  const activeVotes = useMemo(
    () =>
      voteRequests
        .filter((r) => r.status === "pending")
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [voteRequests]
  );

  const awaitingYourVoteCount = useMemo(
    () => activeVotes.filter((r) => r.hasContributed && !r.hasVoted).length,
    [activeVotes]
  );

  const historyVotes = useMemo(
    () =>
      voteRequests
        .filter((r) => ["approved", "rejected", "expired", "executed"].includes(r.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [voteRequests]
  );

  const displayedRequests = useMemo(() => {
    if (activeTab === "active") return activeVotes;
    const start = (historyPage - 1) * ITEMS_PER_PAGE;
    return historyVotes.slice(start, start + ITEMS_PER_PAGE);
  }, [activeTab, activeVotes, historyVotes, historyPage]);

  const totalHistoryPages = Math.ceil(historyVotes.length / ITEMS_PER_PAGE);

  const handleVote = async (requestId: string, voteValue: "approve" | "reject") => {
    if (!user) {
      toast.error("You must be signed in to vote");
      return;
    }
    if (pendingVoteId) return;

    const previous = voteRequests;
    setPendingVoteId(requestId);

    // Optimistic update
    setVoteRequests((prev) =>
      prev.map((req) => {
        if (req.requestId !== requestId) return req;
        const nextVotes = [
          ...(Array.isArray(req.votes) ? req.votes : []).filter((v: any) => v.user_id !== user.id),
          { user_id: user.id, vote: voteValue === "approve", voted_at: new Date().toISOString() },
        ];
        const totalVotes = nextVotes.length;
        const approveVotes = nextVotes.filter((v: any) => v.vote === true).length;
        const rejectVotes = nextVotes.filter((v: any) => v.vote === false).length;
        return {
          ...req,
          hasVoted: true,
          userVote: voteValue,
          votes: nextVotes,
          stats: {
            totalVotes,
            approveVotes,
            rejectVotes,
            approvalRate: totalVotes > 0 ? (approveVotes / totalVotes) * 100 : 0,
            rejectionRate: totalVotes > 0 ? (rejectVotes / totalVotes) * 100 : 0,
          },
        };
      })
    );

    try {
      const result = await voteOnWithdrawal(requestId, voteValue === "approve");
      if (!result.success) throw new Error(result.error || "Failed to record vote");

      if (result.votingStatus) {
        const { participation_rate, approval_rate, status } = result.votingStatus;
        const part = typeof participation_rate === "number" ? `${participation_rate.toFixed(0)}%` : null;
        const appr = typeof approval_rate === "number" ? `${approval_rate.toFixed(0)}%` : null;
        if (status === "approved" || status === "executed") {
          toast.success(
            part && appr
              ? `Payout approved (${part} participated · ${appr} yes)`
              : "Withdrawal approved!"
          );
        } else if (status === "rejected") {
          toast.error("Withdrawal rejected — approval threshold not met");
        } else {
          toast.success(
            part && appr
              ? `Vote recorded · ${part} participation, ${appr} approval`
              : "Vote recorded"
          );
        }
      } else {
        toast.success("Vote recorded");
      }

      await Promise.allSettled([refreshContributionData(true), refreshCurrentUser()]);
    } catch (error) {
      setVoteRequests(previous);
      toast.error(error instanceof Error ? error.message : "Failed to vote");
    } finally {
      setPendingVoteId(null);
    }
  };

  const statusMeta = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Open Vote",
          icon: Clock,
          pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
        };
      case "approved":
        return {
          label: "Approved",
          icon: CheckCircle2,
          pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        };
      case "executed":
        return {
          label: "Paid Out",
          icon: Wallet,
          pill: "bg-primary/12 text-primary",
        };
      case "rejected":
        return {
          label: "Rejected",
          icon: XCircle,
          pill: "bg-red-500/12 text-red-700 dark:text-red-300",
        };
      default:
        return {
          label: "Expired",
          icon: AlertCircle,
          pill: "bg-muted text-muted-foreground",
        };
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      {pendingVoteId && (
        <BrandLoader
          variant="overlay"
          badge="Governance Vote"
          message="Recording your ballot"
          submessage="Updating group consensus and verifying payout thresholds…"
        />
      )}

      <Header mobilePanel />

      <main className="app-page app-panel-page cp-page-enter max-w-3xl">
        {/* Deep-Emerald Governance Hero */}
        <section className="app-panel-hero" aria-labelledby="votes-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="group-detail-back gap-1.5 px-0"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Overview
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#dbf5b4]">
              <ShieldCheck className="h-3.5 w-3.5" />
              70% Must Vote · 60% Yes to Pass
            </span>
          </div>

          <h1 id="votes-heading" className="app-page-title mt-3">
            Governance votes
          </h1>
          <p className="panel-kicker mt-1.5 text-sm">
            Review and decide on payout requests before money leaves your group pools.
          </p>

          {/* Clean 3-Metric Summary Strip */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Needs your vote</span>
              <span
                className={cn(
                  "mt-1 block text-2xl font-extrabold tabular-nums",
                  awaitingYourVoteCount > 0 ? "text-[#dbf5b4]" : "text-white"
                )}
              >
                {awaitingYourVoteCount}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Active ballots</span>
              <span className="mt-1 block text-2xl font-extrabold tabular-nums text-white">
                {activeVotes.length}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Past decisions</span>
              <span className="mt-1 block text-2xl font-extrabold tabular-nums text-white">
                {historyVotes.length}
              </span>
            </div>
          </div>
        </section>

        {/* Overlapping Sheet Body */}
        <div className="app-panel-body space-y-5">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "active" | "history");
              setHistoryPage(1);
            }}
          >
            <TabsList className="app-segmented grid w-full grid-cols-2 bg-muted/60 p-1">
              <TabsTrigger value="active" className="gap-2">
                <Vote className="h-4 w-4" />
                <span>Active</span>
                {activeVotes.length > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums">
                    {activeVotes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {displayedRequests.length === 0 ? (
            <div className="cp-card-native flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
                {activeTab === "active" ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <History className="h-7 w-7" />
                )}
              </span>
              <h2 className="mt-4 text-lg font-bold text-foreground">
                {activeTab === "active" ? "You’re all caught up" : "No past votes yet"}
              </h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {activeTab === "active"
                  ? "There are no open withdrawal proposals waiting for your decision right now."
                  : "Completed withdrawal votes from your groups will appear here."}
              </p>
              <Button asChild variant="outline" className="mt-5 h-11 rounded-xl">
                <Link to="/all-groups">View my groups</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedRequests.map((req) => {
                const meta = statusMeta(req.status);
                const StatusIcon = meta.icon;

                return (
                  <article
                    key={req.requestId}
                    className={cn(
                      "cp-card-native overflow-hidden transition-all",
                      req.status === "pending" && !req.hasVoted && req.hasContributed
                        ? "border-primary/35"
                        : ""
                    )}
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3.5">
                      <Link
                        to={`/groups/${req.contributionId}`}
                        className="group flex min-w-0 items-center gap-2.5"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                          <CategoryIcon category={req.category} size={17} />
                        </span>
                        <div className="min-w-0">
                          <span className="flex items-center gap-1 truncate text-sm font-bold text-foreground group-hover:text-primary">
                            {req.contributionName}
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {formatDate(req.createdAt)}
                          </span>
                        </div>
                      </Link>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                          meta.pill
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>

                    {/* Ballot Content */}
                    <div className="space-y-5 p-5">
                      {/* Amount + Countdown */}
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Requested Payout
                          </span>
                          <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                            ₦{req.amount.toLocaleString("en-NG")}
                          </p>
                        </div>

                        {req.status === "pending" && req.deadline && (
                          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-1.5">
                            <CountdownTimer
                              deadline={req.deadline}
                              size="sm"
                              showLabel={true}
                              className="scale-95 origin-right"
                            />
                          </div>
                        )}
                      </div>

                      {/* Purpose Block */}
                      <div className="rounded-2xl border bg-muted/30 px-4 py-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Stated Purpose
                        </span>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {req.purpose}
                        </p>
                      </div>

                      {/* Clean Consensus Meter */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {req.stats.totalVotes}
                            {req.eligibleVoters > 0 ? ` of ${req.eligibleVoters}` : ""} voted
                            {req.eligibleVoters > 0 && (
                              <span className="font-semibold text-foreground tabular-nums">
                                ({Math.round(req.stats.participationRate)}% / 70% min. voters)
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-foreground tabular-nums">
                            {Math.round(req.stats.approvalRate)}% / {req.threshold}% needed
                          </span>
                        </div>

                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                          {req.stats.totalVotes > 0 && (
                            <>
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${req.stats.approvalRate}%` }}
                              />
                              <div
                                className="h-full bg-destructive/80 transition-all duration-500"
                                style={{ width: `${req.stats.rejectionRate}%` }}
                              />
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground tabular-nums">
                          <span className="text-primary">Approve ({req.stats.approveVotes})</span>
                          <span className="text-destructive/90">Reject ({req.stats.rejectVotes})</span>
                        </div>
                      </div>

                      {/* Clean Action Footer */}
                      {req.hasContributed ? (
                        req.hasVoted ? (
                          <div
                            className={cn(
                              "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold",
                              req.userVote === "approve"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                            )}
                          >
                            {req.userVote === "approve" ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                You voted to Approve
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                You voted to Reject
                              </>
                            )}
                          </div>
                        ) : req.status === "pending" ? (
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              type="button"
                              onClick={() => handleVote(req.requestId, "approve")}
                              disabled={pendingVoteId === req.requestId}
                              className="h-12 gap-2 rounded-xl font-bold shadow-sm"
                            >
                              <ThumbsUp className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleVote(req.requestId, "reject")}
                              disabled={pendingVoteId === req.requestId}
                              className="h-12 gap-2 rounded-xl border-destructive/35 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <ThumbsDown className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <p className="rounded-xl bg-muted/40 py-2.5 text-center text-xs font-medium text-muted-foreground">
                            Voting has closed for this proposal
                          </p>
                        )
                      ) : (
                        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-center text-xs font-medium text-amber-800 dark:text-amber-300">
                          Contribute to this pool to unlock voting rights
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}

              {activeTab === "history" && totalHistoryPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    aria-label="Previous history page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    Page {historyPage} of {totalHistoryPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                    aria-label="Next history page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VotesPage;
