
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Contribution, WithdrawalRequest, hasContributed } from "@/services/localStorage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, Clock, X } from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import CountdownTimer from "@/components/ui/countdown-timer";
import { useIsMobile } from "@/hooks/use-mobile";

interface WithdrawalRequestsProps {
  contribution: Contribution;
  contributionRequests: WithdrawalRequest[];
  hasUserContributed: boolean;
}

const WithdrawalRequests = ({
  contribution,
  contributionRequests,
  hasUserContributed
}: WithdrawalRequestsProps) => {
  const { user } = useSupabaseUser();
  const { vote, pingMembersForVote } = useSupabaseContribution();
  const isMobile = useIsMobile();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const hasVoted = (request: WithdrawalRequest) => {
    return request.votes.some(v => v.userId === user.id);
  };

  const userVote = (request: WithdrawalRequest) => {
    const userVoteData = request.votes.find(v => v.userId === user.id);
    return userVoteData ? userVoteData.vote : null;
  };

  const handleVote = (requestId: string, voteValue: 'approve' | 'reject') => {
    if (!hasUserContributed) {
      return;
    }
    vote(requestId, voteValue);
  };

  const handlePingMembers = (requestId: string) => {
    pingMembersForVote(requestId);
  };

  const sortedRequests = [...contributionRequests].sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    return bDate - aDate;
  });

  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader>
        <CardTitle>Withdrawal Requests</CardTitle>
        <CardDescription>Vote on pending withdrawal requests (51% approval threshold)</CardDescription>
      </CardHeader>
      <CardContent>
        {contributionRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No withdrawal requests yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRequests.map(request => (
              <Card key={request.id} className={`overflow-hidden ${
                request.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : 
                request.status === 'approved' ? 'border-green-200 dark:border-green-800' : 
                request.status === 'expired' ? 'border-gray-200 dark:border-gray-800' : 
                'border-red-200 dark:border-red-800'
              }`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <div className="font-semibold mb-1 flex flex-wrap items-center gap-2">
                        <span>₦{request.amount.toLocaleString()}</span>
                        <Badge className="ml-0 md:ml-2" variant={
                          request.status === 'pending' ? 'outline' : 
                          request.status === 'approved' ? 'default' : 
                          request.status === 'expired' ? 'secondary' : 
                          'destructive'
                        }>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.purpose}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested: {formatDate(request.createdAt)}
                      </p>
                    </div>
                    
                    <div className="flex md:flex-col justify-between items-center md:items-end gap-2">
                      {request.status === 'pending' && request.deadline && (
                        <CountdownTimer deadline={request.deadline} size={isMobile ? "sm" : "md"} showLabel={false} />
                      )}
                      
                      <div className="text-right text-sm">
                        <p className="font-medium">
                          {request.votes.length} / {contribution.members.filter(m => hasContributed(m, contribution.id)).length} votes
                        </p>
                        <p className="text-xs text-muted-foreground">
                          51% approval needed
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {request.status === 'pending' && !hasVoted(request) ? (
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <Button 
                        onClick={() => handleVote(request.id, 'approve')} 
                        className="flex-1 bg-green-600 hover:bg-green-700" 
                        size="sm" 
                        disabled={!hasUserContributed}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        onClick={() => handleVote(request.id, 'reject')} 
                        variant="outline" 
                        className="flex-1" 
                        size="sm" 
                        disabled={!hasUserContributed}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  ) : request.status === 'pending' && hasVoted(request) ? (
                    <div className="mt-4 text-sm text-center p-2 bg-muted rounded-md">
                      You voted to {userVote(request) === 'approve' ? 'approve' : 'reject'} this request.
                    </div>
                  ) : null}
                  
                  {request.status === 'pending' && hasUserContributed && (
                    <div className="mt-2 flex justify-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs" 
                        onClick={() => handlePingMembers(request.id)}
                      >
                        <Bell className="h-3 w-3 mr-1 text-green-600" />
                        Remind others to vote
                      </Button>
                    </div>
                  )}
                  
                  {request.status === 'pending' && !hasUserContributed && (
                    <div className="mt-2 text-xs text-amber-500 text-center">
                      You must contribute to this group before you can vote
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WithdrawalRequests;
