import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WalletContributionService, GroupRefundRequest } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { ThumbsUp, ThumbsDown, Clock, CheckCircle, CheckCircle2, XCircle, Loader2, BarChart3, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import BrandLoader from '@/components/ui/BrandLoader';
import { supportLink } from '@/services/supabase/supportService';

interface RefundRequestsCardProps {
  groupId: string;
  votingThreshold?: number | null;
  hasVotingRights?: boolean;
  canRetryRefund?: boolean;
}

export function RefundRequestsCard({
  groupId,
  votingThreshold,
  hasVotingRights = true,
  canRetryRefund = false,
}: RefundRequestsCardProps) {
  const approvalThreshold =
    votingThreshold && votingThreshold >= 50 && votingThreshold <= 100
      ? Math.round(votingThreshold)
      : 60;
  const [requests, setRequests] = useState<GroupRefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingOn, setVotingOn] = useState<string | null>(null);
  const { user } = useSupabaseUser();

  useEffect(() => {
    loadRequests();

    // Set up real-time subscription for refund requests
    const channel = supabase
      .channel(`refund_requests_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_refund_requests',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          console.log('Refund request update:', payload);
          // Reload requests when any change occurs
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const loadRequests = async () => {
    setLoading(true);
    const data = await WalletContributionService.getGroupRefundRequests(groupId);
    setRequests(data);
    setLoading(false);
  };

  const handleVote = async (requestId: string, vote: 'for' | 'against') => {
    if (!user) {
      toast.error('Please login to vote');
      return;
    }
    if (votingOn) return;

    const previousRequests = requests;
    setVotingOn(requestId);

    // Optimistic UI update (safe against null votes and duplicate votes)
    setRequests((prevRequests) =>
      prevRequests.map((req) => {
        if (req.id !== requestId) return req;
        const existingVotes = Array.isArray(req.votes) ? req.votes : [];
        const newVotes = [
          ...existingVotes.filter((v: any) => v.user_id !== user.id),
          { user_id: user.id, vote, voted_at: new Date().toISOString() },
        ];
        const votesFor = newVotes.filter((v: any) => v.vote === 'for').length;
        const votesAgainst = newVotes.filter((v: any) => v.vote === 'against').length;

        return {
          ...req,
          votes: newVotes,
          total_votes_for: votesFor,
          total_votes_against: votesAgainst,
        };
      })
    );

    try {
      const ok = await WalletContributionService.voteOnRefund(requestId, user.id, vote);
      if (!ok) {
        setRequests(previousRequests);
      } else {
        await loadRequests();
      }
    } catch {
      setRequests(previousRequests);
    } finally {
      setVotingOn(null);
    }
  };

  const hasUserVoted = (request: GroupRefundRequest) => {
    if (!user || !Array.isArray(request.votes)) return false;
    return request.votes.some((v: any) => v.user_id === user.id);
  };

  const getUserVote = (request: GroupRefundRequest) => {
    if (!user || !Array.isArray(request.votes)) return null;
    const vote = request.votes.find((v: any) => v.user_id === user.id);
    return vote?.vote;
  };

  const validVoteCount = (request: GroupRefundRequest) => (request.total_votes_for || 0) + (request.total_votes_against || 0);

  const getVotePercentage = (request: GroupRefundRequest) => {
    const votes = validVoteCount(request);
    return votes ? Math.min(100, (request.total_votes_for / votes) * 100) : 0;
  };

  const getParticipationPercentage = (request: GroupRefundRequest) =>
    request.total_eligible_voters ? Math.min(100, (validVoteCount(request) / request.total_eligible_voters) * 100) : 0;

  const getDaysRemaining = (deadline: string) => {
    const end = Date.parse(deadline);
    if (!Number.isFinite(end)) return 0;
    const diff = end - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50">Voting</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Rejected</Badge>;
      case 'executed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="rounded-[1.35rem]">
        <CardContent className="flex items-center justify-center py-8">
          <BrandLoader variant="inline" message="Loading refund votes…" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show card if no requests
  }

  return (
    <>
    {votingOn && (
      <BrandLoader
        variant="overlay"
        badge="Governance Vote"
        message="Recording your vote"
        submessage="Updating group refund consensus…"
      />
    )}
    <Card className="rounded-[1.35rem]">
      <CardHeader>
        <CardTitle>Refund Requests</CardTitle>
        <CardDescription>
          Vote on pending refund requests
        </CardDescription>
        
        {/* Governance Rules Display */}
        <div className="mt-4 bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Governance Rules (Transparent & Fair)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white dark:bg-gray-900 p-3 rounded border">
              <div className="font-medium text-blue-600 dark:text-blue-400">{approvalThreshold}% Approval</div>
              <div className="text-xs text-muted-foreground mt-1">
                {approvalThreshold}% of voters must vote "For"
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded border">
              <div className="font-medium text-green-600 dark:text-green-400">70% Participation</div>
              <div className="text-xs text-muted-foreground mt-1">
                70% of contributors must vote
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded border">
              <div className="font-medium text-purple-600 dark:text-purple-400">7 Days Period</div>
              <div className="text-xs text-muted-foreground mt-1">
                Auto-approve if thresholds met early
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-2">
            <span>
              <strong>How it works:</strong> If 70% of eligible contributors vote AND {approvalThreshold}% vote "For", the refund is approved and executed automatically.
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => {
          const votePercentage = getVotePercentage(request);
          const daysRemaining = getDaysRemaining(request.voting_deadline);
          const userVoted = hasUserVoted(request);
          const userVote = getUserVote(request);
          const isVoting = votingOn === request.id;

          return (
            <div key={request.id} className="border rounded-lg p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(request.status)}
                    {request.refund_type === 'partial' && (
                      <Badge variant="secondary">
                        {request.partial_percentage}% Refund
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {request.reason}
                  </p>
                </div>
              </div>
              {request.status === 'approved' && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">Approved. Wallet credits are pending.</p>
                  {canRetryRefund && <Button type="button" variant="outline" size="sm" disabled={!!votingOn} onClick={async () => {
                    setVotingOn(request.id);
                    await WalletContributionService.processRefund(request.id);
                    await loadRequests();
                    setVotingOn(null);
                  }}>Retry settlement</Button>}
                  {canRetryRefund && <p className="w-full text-xs text-muted-foreground">Link any outstanding bank contributions under Manage before retrying.</p>}
                </div>
              )}

              {/* Voting Progress */}
              {request.status === 'pending' && (
                <>
                  {/* Participation Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Participation: {validVoteCount(request)} of {request.total_eligible_voters} voted
                      </span>
                      <span className={`font-bold ${
                        getParticipationPercentage(request) >= 70 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        {typeof getParticipationPercentage(request) === 'number' && Number.isFinite(getParticipationPercentage(request))
                          ? getParticipationPercentage(request).toFixed(0)
                          : '0'}%
                      </span>
                    </div>
                    <Progress 
                      value={getParticipationPercentage(request)} 
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Need 70% to proceed</span>
                      {getParticipationPercentage(request) >= 70 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Threshold met
                        </span>
                      ) : (
                        <span className="text-orange-600">
                          {Math.ceil(request.total_eligible_voters * 0.7) - (validVoteCount(request))} more needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Approval Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Approval: {request.total_votes_for || 0} of {validVoteCount(request)} voted "For"
                      </span>
                      <span className={`font-bold ${
                        votePercentage >= approvalThreshold 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        {typeof votePercentage === 'number' && Number.isFinite(votePercentage)
                          ? votePercentage.toFixed(0)
                          : '0'}%
                      </span>
                    </div>
                    <Progress value={votePercentage} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Need {approvalThreshold}% approval</span>
                      {votePercentage >= approvalThreshold ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Threshold met
                        </span>
                      ) : (
                        <span className="text-orange-600">
                          {Math.max(1, Math.ceil((validVoteCount(request)) * (approvalThreshold / 100)) - (request.total_votes_for || 0))} more "For" votes needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Summary */}
                  {getParticipationPercentage(request) >= 70 && votePercentage >= approvalThreshold && (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Both thresholds met! Refund will be approved automatically.
                      </p>
                    </div>
                  )}

                  {/* Vote Counts */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <ThumbsUp className="h-4 w-4" />
                      <span>{request.total_votes_for}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <ThumbsDown className="h-4 w-4" />
                      <span>{request.total_votes_against}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                      <Clock className="h-4 w-4" />
                      <span>
                        {daysRemaining > 0
                          ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`
                          : 'Voting window ended'}
                      </span>
                    </div>
                  </div>

                  {/* Voting Buttons */}
                  {!hasVotingRights ? (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-center text-xs font-medium text-amber-800 dark:text-amber-300">
                      Contribute to this group to unlock refund voting rights.
                    </div>
                  ) : !userVoted ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleVote(request.id, 'for')}
                        disabled={isVoting}
                        className="flex-1"
                        variant="outline"
                      >
                        {isVoting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ThumbsUp className="h-4 w-4 mr-2" />
                        )}
                        Vote For
                      </Button>
                      <Button
                        onClick={() => handleVote(request.id, 'against')}
                        disabled={isVoting}
                        className="flex-1"
                        variant="outline"
                      >
                        {isVoting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 mr-2" />
                        )}
                        Vote Against
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-2 bg-muted rounded-lg">
                      {userVote === 'for' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">You voted For</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">You voted Against</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Executed / Rejected Status */}
              {request.status === 'executed' && request.execution_details && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-accent/60 p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-foreground">
                    Refund completed: <strong className="tabular-nums">₦{(request.execution_details as any).total_refunded?.toLocaleString()}</strong>{' '}
                    refunded to {(request.execution_details as any).refunds_processed} contributors
                  </p>
                </div>
              )}
              {request.status === 'approved' && request.requester_id === user?.id && (
                <Button asChild variant="outline" size="sm"><Link to={supportLink("group_refund", request.id)}>Get help with this refund</Link></Button>
              )}

              {request.status === 'rejected' && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                  <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-900 dark:text-red-200">
                    Refund request was rejected by the group
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
    </>
  );
}
