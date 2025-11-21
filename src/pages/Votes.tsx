
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ThumbsUp, ThumbsDown, Clock, Users, CheckCircle2, XCircle, Activity, Wallet, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Badge } from "@/components/ui/badge";
import { format, isValid } from "date-fns";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import CountdownTimer from "@/components/ui/countdown-timer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";
import { voteOnWithdrawal } from "@/services/supabase/withdrawalService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VotesPage = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { contributions, withdrawalRequests, refreshContributionData } = useSupabaseContribution();
  const [voteRequests, setVoteRequests] = useState<any[]>([]);
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  useEffect(() => {
    if (user && contributions && withdrawalRequests) {
      setUserVotes();
    }
  }, [user, contributions, withdrawalRequests]);
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMM d, yyyy • h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const setUserVotes = () => {
    const formattedRequests = withdrawalRequests
      .filter(request => ['pending', 'approved', 'rejected', 'expired', 'executed'].includes(request.status))
      .map(request => {
        const contribution = contributions.find(c => c.id === request.contribution_id);
        const hasContributed = contribution ? true : false;
        const votes = (request.votes as any) || [];
        const votesArray = Array.isArray(votes) ? votes : [];
        const hasVoted = votesArray.some((v: any) => v.user_id === user?.id);
        const userVoteData = votesArray.find((v: any) => v.user_id === user?.id);
        const userVote = userVoteData ? (userVoteData.vote === true ? 'approve' : 'reject') : undefined;
        
        // Calculate stats
        // Note: In a real app, total voters should come from the group member count
        // For now, we'll estimate based on votes or some mock data if available
        const totalVotes = votesArray.length;
        const approveVotes = votesArray.filter((v: any) => v.vote === true).length;
        const rejectVotes = votesArray.filter((v: any) => v.vote === false).length;
        
        const approvalRate = totalVotes > 0 ? (approveVotes / totalVotes) * 100 : 0;
        const rejectionRate = totalVotes > 0 ? (rejectVotes / totalVotes) * 100 : 0;

        return {
          requestId: request.id,
          contributionId: request.contribution_id,
          contributionName: contribution ? contribution.name : "Unknown Group",
          amount: request.amount,
          purpose: request.purpose || "No purpose specified",
          createdAt: request.created_at,
          deadline: request.deadline,
          hasContributed,
          hasVoted,
          userVote,
          votes: votesArray,
          status: request.status,
          stats: {
            totalVotes,
            approveVotes,
            rejectVotes,
            approvalRate,
            rejectionRate
          }
        };
      });
    
    // Sort: Pending first, then by date
    formattedRequests.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setVoteRequests(formattedRequests);
  };
  
  const handleVote = async (requestId: string, voteValue: 'approve' | 'reject') => {
    if (!user) {
      toast.error('You must be logged in to vote');
      return;
    }

    if (pendingVoteId) {
      return;
    }

    const previousRequests = voteRequests;
    setPendingVoteId(requestId);

    // Optimistic UI update
    setVoteRequests(prev =>
      prev.map(request => {
        if (request.requestId !== requestId) return request;

        const newVote = {
          user_id: user.id,
          vote: voteValue === 'approve',
          voted_at: new Date().toISOString()
        };

        const currentVotes = Array.isArray(request.votes) ? request.votes : [];
        // Remove existing vote if any (though logic prevents double voting usually)
        const filteredVotes = currentVotes.filter((v: any) => v.user_id !== user.id);
        const newVotes = [...filteredVotes, newVote];

        // Recalculate stats optimistically
        const totalVotes = newVotes.length;
        const approveVotes = newVotes.filter((v: any) => v.vote === true).length;
        const rejectVotes = newVotes.filter((v: any) => v.vote === false).length;
        const approvalRate = totalVotes > 0 ? (approveVotes / totalVotes) * 100 : 0;
        const rejectionRate = totalVotes > 0 ? (rejectVotes / totalVotes) * 100 : 0;

        return {
          ...request,
          hasVoted: true,
          userVote: voteValue,
          votes: newVotes,
          stats: {
            totalVotes,
            approveVotes,
            rejectVotes,
            approvalRate,
            rejectionRate
          }
        };
      })
    );

    try {
      const voteBoolean = voteValue === 'approve';
      const result = await voteOnWithdrawal(requestId, voteBoolean);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to vote');
      }
      
      if (result.votingStatus) {
        const { participation_rate, approval_rate, status } = result.votingStatus;
        
        if (status === 'approved' || status === 'executed') {
          toast.success(`Withdrawal approved! ${participation_rate.toFixed(0)}% participated, ${approval_rate.toFixed(0)}% approved`);
        } else if (status === 'rejected') {
          toast.error('Withdrawal rejected - thresholds not met');
        } else {
          toast.success(`Vote recorded! Participation: ${participation_rate.toFixed(0)}%, Approval: ${approval_rate.toFixed(0)}%`);
        }
      } else {
        toast.success('Vote recorded successfully!');
      }
      
      await refreshContributionData();
      setUserVotes();
    } catch (error) {
      // Revert optimistic update
      setVoteRequests(previousRequests);
      console.error('Error voting:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to vote');
    } finally {
      setPendingVoteId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800';
      case 'approved': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      case 'executed': return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
      case 'expired': return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3.5 h-3.5 mr-1.5" />;
      case 'approved': return <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />;
      case 'executed': return <Wallet className="w-3.5 h-3.5 mr-1.5" />;
      case 'rejected': return <XCircle className="w-3.5 h-3.5 mr-1.5" />;
      case 'expired': return <AlertCircle className="w-3.5 h-3.5 mr-1.5" />;
      default: return <Activity className="w-3.5 h-3.5 mr-1.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <Header />
      
      <main className="container max-w-3xl mx-auto px-4 pt-24 pb-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="-ml-2 text-muted-foreground hover:text-foreground" 
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Governance</h1>
          <p className="text-muted-foreground mt-1">Vote on withdrawal requests from your groups.</p>
        </div>

        {voteRequests.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">All Caught Up!</h3>
              <p className="text-muted-foreground max-w-xs">
                There are no pending withdrawal requests requiring your vote at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {voteRequests.map(request => (
              <Card 
                key={request.requestId} 
                className={cn(
                  "overflow-hidden transition-all duration-300 border shadow-sm hover:shadow-md",
                  request.status === 'pending' ? "ring-1 ring-primary/10 dark:ring-primary/20" : "opacity-90"
                )}
              >
                {/* Header Status Banner for Non-Pending */}
                {request.status !== 'pending' && (
                  <div className={cn(
                    "w-full h-1.5",
                    request.status === 'approved' || request.status === 'executed' ? "bg-green-500" :
                    request.status === 'rejected' ? "bg-red-500" : "bg-gray-300"
                  )} />
                )}

                <CardHeader className="pb-3 space-y-0">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={cn("font-medium px-2.5 py-0.5 rounded-full border", getStatusColor(request.status))}
                        >
                          {getStatusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium flex items-center">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mx-2" />
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                      <CardTitle className="text-2xl font-bold flex items-baseline gap-1 text-foreground">
                        <span className="text-muted-foreground text-lg font-normal">₦</span>
                        {request.amount.toLocaleString()}
                      </CardTitle>
                      <CardDescription className="text-base font-medium text-foreground/80">
                        For {request.contributionName}
                      </CardDescription>
                    </div>

                    {request.status === 'pending' && request.deadline && (
                      <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-100 dark:border-amber-900/50">
                        <CountdownTimer 
                          deadline={request.deadline} 
                          size={isMobile ? "sm" : "sm"}
                          showLabel={true}
                          className="scale-90 origin-top-right"
                        />
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 mb-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Purpose</h4>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      "{request.purpose}"
                    </p>
                  </div>

                  {/* Voting Stats */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{request.stats.totalVotes} votes cast</span>
                      </div>
                      <span className="font-medium">
                        {Math.round(request.stats.approvalRate)}% Approval
                      </span>
                    </div>
                    
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                      {request.stats.totalVotes > 0 && (
                        <>
                          <div 
                            className="bg-green-500 h-full transition-all duration-500" 
                            style={{ width: `${request.stats.approvalRate}%` }}
                          />
                          <div 
                            className="bg-red-500 h-full transition-all duration-500" 
                            style={{ width: `${request.stats.rejectionRate}%` }}
                          />
                        </>
                      )}
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Approve ({request.stats.approveVotes})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Reject ({request.stats.rejectVotes})</span>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {request.hasContributed ? (
                    request.hasVoted ? (
                      <div className={cn(
                        "py-3 px-4 rounded-lg border flex items-center justify-center gap-2 font-medium text-sm",
                        request.userVote === 'approve' 
                          ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" 
                          : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                      )}>
                        {request.userVote === 'approve' ? (
                          <><CheckCircle2 className="w-4 h-4" /> You voted to Approve</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> You voted to Reject</>
                        )}
                      </div>
                    ) : request.status === 'pending' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          onClick={() => handleVote(request.requestId, 'approve')} 
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-11"
                          disabled={pendingVoteId === request.requestId}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button 
                          onClick={() => handleVote(request.requestId, 'reject')} 
                          variant="destructive" 
                          className="w-full bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 dark:bg-transparent dark:border-red-900/30 dark:text-red-400 shadow-sm h-11"
                          disabled={pendingVoteId === request.requestId}
                        >
                          <ThumbsDown className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                        Voting is closed
                      </div>
                    )
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm text-center dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                      Only active contributors can vote on this request
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <MobileNav />
    </div>
  );
};

export default VotesPage;
