
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Bell, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { hasContributed } from "@/services/localStorage";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface VoteData {
  requestId: string;
  contributionId: string;
  contributionName: string;
  amount: number;
  purpose?: string;
  createdAt: string;
  deadline: string;
  hasContributed: boolean;
  hasVoted: boolean;
  userVote: 'approve' | 'reject' | null;
  votes: { userId: string; vote: 'approve' | 'reject' }[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

const Votes = () => {
  const navigate = useNavigate();
  const { withdrawalRequests, contributions, user, vote, pingMembersForVote } = useApp();
  const [eligibleVotes, setEligibleVotes] = useState<VoteData[]>([]);
  
  useEffect(() => {
    // Filter for pending withdrawal requests where the user is a member
    const pendingRequests = withdrawalRequests.filter(request => {
      const contribution = contributions.find(c => c.id === request.contributionId);
      return (
        request.status === 'pending' &&
        contribution && 
        contribution.members?.includes(user.id)
      );
    });
    
    // Prepare the data with additional information
    const eligibleRequestsData = pendingRequests.map(request => {
      const contribution = contributions.find(c => c.id === request.contributionId);
      const userCanContribute = hasContributed(user.id, request.contributionId);
      const userHasVoted = request.votes.some(v => v.userId === user.id);
      const userVoteValue = request.votes.find(v => v.userId === user.id)?.vote || null;
      
      return {
        requestId: request.id,
        contributionId: request.contributionId,
        contributionName: contribution ? contribution.name : 'Unknown Group',
        amount: request.amount,
        purpose: request.purpose,
        createdAt: request.createdAt,
        deadline: request.deadline,
        hasContributed: userCanContribute,
        hasVoted: userHasVoted,
        userVote: userVoteValue,
        votes: request.votes,
        status: request.status
      } as VoteData;
    });
    
    setEligibleVotes(eligibleRequestsData);
  }, [withdrawalRequests, contributions, user.id]);
  
  const handleVote = (requestId: string, voteValue: 'approve' | 'reject') => {
    const voteInfo = eligibleVotes.find(v => v.requestId === requestId);
    
    if (!voteInfo?.hasContributed) {
      toast.error("You must contribute to this group before voting");
      return;
    }
    
    vote(requestId, voteValue);
    toast.success(`Your vote has been submitted: ${voteValue}`);
    
    // Update local state
    setEligibleVotes(prev => 
      prev.map(v => 
        v.requestId === requestId 
          ? {...v, hasVoted: true, userVote: voteValue} 
          : v
      )
    );
  };
  
  const handleRemind = (requestId: string) => {
    pingMembersForVote(requestId);
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  const formatDeadline = (deadlineString: string) => {
    const deadlineDate = new Date(deadlineString);
    const now = new Date();
    
    if (deadlineDate > now) {
      return formatDistanceToNow(deadlineDate);
    } else {
      return 'Expired';
    }
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Pending Votes</h1>
          <p className="text-muted-foreground">Cast your vote on pending withdrawal requests</p>
        </div>
        
        {eligibleVotes.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <h3 className="text-lg font-medium">No pending votes</h3>
                <p className="text-muted-foreground mt-2">
                  There are no withdrawal requests that need your vote at this time.
                </p>
                <Button 
                  className="mt-4 bg-[#42ab35] hover:bg-[#378d2b]" 
                  onClick={() => navigate("/dashboard")}
                >
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {eligibleVotes.map(vote => (
              <Card key={vote.requestId}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{vote.contributionName}</CardTitle>
                      <CardDescription>
                        Withdrawal Request • {formatDate(vote.createdAt)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {vote.votes.length} / {contributions.find(c => c.id === vote.contributionId)?.members?.filter(m => 
                        hasContributed(m, vote.contributionId)
                      ).length || 0} Votes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-semibold text-xl">₦{vote.amount.toLocaleString()}</p>
                    <p className="text-muted-foreground">{vote.purpose}</p>
                    <div className="flex items-center mt-2 text-sm text-amber-500">
                      <Clock className="h-4 w-4 mr-2" />
                      Time remaining: {formatDeadline(vote.deadline)}
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium">Voting Progress</p>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">
                          Approve: {vote.votes.filter(v => v.vote === 'approve').length}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">
                          Reject: {vote.votes.filter(v => v.vote === 'reject').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col space-y-3">
                  <div className="flex justify-end w-full space-x-2">
                    {!vote.hasVoted ? (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => handleVote(vote.requestId, 'reject')}
                          disabled={!vote.hasContributed}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button 
                          onClick={() => handleVote(vote.requestId, 'approve')}
                          disabled={!vote.hasContributed}
                          className="bg-[#42ab35] hover:bg-[#378d2b]"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </>
                    ) : (
                      <Badge variant={vote.userVote === 'approve' ? 'default' : 'destructive'}>
                        You voted: {vote.userVote === 'approve' ? 'Approved' : 'Rejected'}
                      </Badge>
                    )}
                  </div>
                  
                  {!vote.hasContributed && (
                    <p className="text-xs text-amber-500 text-right">
                      You must contribute to this group before voting
                    </p>
                  )}
                  
                  {vote.hasContributed && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="self-center" 
                      onClick={() => handleRemind(vote.requestId)}
                    >
                      <Bell className="h-4 w-4 mr-2 text-[#42AB35]" />
                      Remind others to vote
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <MobileNav />
    </div>
  );
};

export default Votes;
