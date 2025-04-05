
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { hasContributed } from "@/services/localStorage";
import { format } from "date-fns";
import { toast } from "sonner";

const Votes = () => {
  const navigate = useNavigate();
  const { withdrawalRequests, contributions, user, vote } = useApp();
  const [eligibleVotes, setEligibleVotes] = useState<Array<{
    requestId: string;
    contributionId: string;
    contributionName: string;
    amount: number;
    purpose: string;
    createdAt: string;
    hasContributed: boolean;
    hasVoted: boolean;
    userVote: 'approve' | 'reject' | null;
    votes: { userId: string; vote: 'approve' | 'reject' }[];
    status: 'pending' | 'approved' | 'rejected';
  }>>([]);
  
  useEffect(() => {
    // Filter for pending withdrawal requests where the user is a member
    const pendingRequests = withdrawalRequests.filter(request => {
      const contribution = contributions.find(c => c.id === request.contributionId);
      return (
        request.status === 'pending' &&
        contribution && 
        contribution.members.includes(user.id)
      );
    });
    
    // Prepare the data with additional information
    const eligibleRequestsData = pendingRequests.map(request => {
      const contribution = contributions.find(c => c.id === request.contributionId);
      const userCanContribute = contribution ? hasContributed(user.id, contribution.id) : false;
      const userHasVoted = request.votes.some(v => v.userId === user.id);
      const userVoteValue = request.votes.find(v => v.userId === user.id)?.vote || null;
      
      return {
        requestId: request.id,
        contributionId: request.contributionId,
        contributionName: contribution ? contribution.name : 'Unknown Group',
        amount: request.amount,
        purpose: request.purpose,
        createdAt: request.createdAt,
        hasContributed: userCanContribute,
        hasVoted: userHasVoted,
        userVote: userVoteValue,
        votes: request.votes,
        status: request.status
      };
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
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
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
                  className="mt-4" 
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
                      {vote.votes.length} / {contributions.find(c => c.id === vote.contributionId)?.members.length || 0} Votes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-semibold text-xl">₦{vote.amount.toLocaleString()}</p>
                    <p className="text-muted-foreground">{vote.purpose}</p>
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
                <CardFooter className="justify-end space-x-2">
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
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      
                      {!vote.hasContributed && (
                        <p className="text-xs text-amber-500 absolute -bottom-6 right-4">
                          You must contribute to this group before voting
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge variant={vote.userVote === 'approve' ? 'default' : 'destructive'}>
                      You voted: {vote.userVote === 'approve' ? 'Approved' : 'Rejected'}
                    </Badge>
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
