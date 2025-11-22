import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WalletContributionService, GroupRefundRequest } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface RefundRequestsCardProps {
  groupId: string;
}

export function RefundRequestsCard({ groupId }: RefundRequestsCardProps) {
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

    // Optimistic UI update
    setVotingOn(requestId);
    
    // Update the local state immediately
    setRequests((prevRequests) =>
      prevRequests.map((req) => {
        if (req.id === requestId) {
          const newVotes = [
            ...req.votes,
            { user_id: user.id, vote, voted_at: new Date().toISOString() }
          ];
          const votesFor = newVotes.filter((v: any) => v.vote === 'for').length;
          const votesAgainst = newVotes.filter((v: any) => v.vote === 'against').length;
          
          return {
            ...req,
            votes: newVotes,
            total_votes_for: votesFor,
            total_votes_against: votesAgainst,
          };
        }
        return req;
      })
    );

    // Submit the vote to the backend
    const success = await WalletContributionService.voteOnRefund(requestId, user.id, vote);
    
    if (!success) {
      // Revert optimistic update if vote failed
      await loadRequests();
    }
    
    setVotingOn(null);
  };

  const hasUserVoted = (request: GroupRefundRequest) => {
    if (!user) return false;
    return request.votes.some((v: any) => v.user_id === user.id);
  };

  const getUserVote = (request: GroupRefundRequest) => {
    if (!user) return null;
    const vote = request.votes.find((v: any) => v.user_id === user.id);
    return vote?.vote;
  };

  const getVotePercentage = (request: GroupRefundRequest) => {
    if (!request.total_eligible_voters || request.total_eligible_voters === 0) return 0;
    if (!request.votes || request.votes.length === 0) return 0;
    return (request.total_votes_for / request.votes.length) * 100;
  };

  const getParticipationPercentage = (request: GroupRefundRequest) => {
    if (!request.total_eligible_voters || request.total_eligible_voters === 0) return 0;
    if (!request.votes) return 0;
    return (request.votes.length / request.total_eligible_voters) * 100;
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show card if no requests
  }

  return (
    <Card>
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
              <div className="font-medium text-blue-600 dark:text-blue-400">60% Approval</div>
              <div className="text-xs text-muted-foreground mt-1">
                60% of voters must vote "For"
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
            <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>How it works:</strong> If 70% of contributors vote AND 60% vote "For", the refund is approved immediately. 
              Otherwise, voting continues for 7 days. If thresholds aren't met by deadline, request is rejected.
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

              {/* Voting Progress */}
              {request.status === 'pending' && (
                <>
                  {/* Participation Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">
                        📊 Participation: {request.votes?.length || 0} of {request.total_eligible_voters} voted
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
                        <span className="text-green-600 font-medium">✓ Threshold met</span>
                      ) : (
                        <span className="text-orange-600">
                          {Math.ceil(request.total_eligible_voters * 0.7) - (request.votes?.length || 0)} more needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Approval Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">
                        ✅ Approval: {request.total_votes_for || 0} of {request.votes?.length || 0} voted "For"
                      </span>
                      <span className={`font-bold ${
                        votePercentage >= 60 
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
                      <span>Need 60% approval</span>
                      {votePercentage >= 60 ? (
                        <span className="text-green-600 font-medium">✓ Threshold met</span>
                      ) : (
                        <span className="text-orange-600">
                          {Math.ceil((request.votes?.length || 0) * 0.6) - (request.total_votes_for || 0)} more "For" votes needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Summary */}
                  {getParticipationPercentage(request) >= 70 && votePercentage >= 60 && (
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
                      <span>{daysRemaining} days left</span>
                    </div>
                  </div>

                  {/* Voting Buttons */}
                  {!userVoted ? (
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

              {/* Approved/Executed Status */}
              {request.status === 'approved' && (
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✅ Refund approved! Processing refunds to all contributors...
                  </p>
                </div>
              )}

              {request.status === 'executed' && request.execution_details && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ✅ Refund completed! ₦{(request.execution_details as any).total_refunded?.toLocaleString()} 
                    refunded to {(request.execution_details as any).refunds_processed} contributors
                  </p>
                </div>
              )}

              {request.status === 'rejected' && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ❌ Refund request was rejected by the group
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
