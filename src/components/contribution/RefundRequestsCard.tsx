import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WalletContributionService, GroupRefundRequest } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

    setVotingOn(requestId);
    const success = await WalletContributionService.voteOnRefund(requestId, user.id, vote);
    
    if (success) {
      await loadRequests(); // Refresh to show updated votes
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
    if (request.total_eligible_voters === 0) return 0;
    return (request.total_votes_for / request.total_eligible_voters) * 100;
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {request.total_votes_for} of {request.total_eligible_voters} votes needed
                      </span>
                      <span className="font-medium">
                        {votePercentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={votePercentage} className="h-2" />
                  </div>

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
