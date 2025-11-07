
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { format, isValid } from "date-fns";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import CountdownTimer from "@/components/ui/countdown-timer";
import { useIsMobile } from "@/hooks/use-mobile";

const VotesPage = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { contributions, withdrawalRequests, vote } = useSupabaseContribution();
  const [voteRequests, setVoteRequests] = useState<any[]>([]);
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
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  const setUserVotes = () => {
    const formattedRequests = withdrawalRequests
      .filter(request => request.status === "pending" || request.status === "approved" || request.status === "rejected" || request.status === "expired")
      .map(request => {
        const contribution = contributions.find(c => c.id === request.contribution_id);
        // Check if user has contributed by looking at contributors table
        const hasContributed = contribution ? true : false; // Simplified for now
        const votes = (request.votes as any) || [];
        const votesArray = Array.isArray(votes) ? votes : [];
        const hasVoted = votesArray.some((v: any) => v.user_id === user.id);
        const userVote = votesArray.find((v: any) => v.user_id === user.id)?.vote as "approve" | "reject";
        
        return {
          requestId: request.id,
          contributionId: request.contribution_id,
          contributionName: contribution ? contribution.name : "Unknown Contribution",
          amount: request.amount,
          purpose: request.purpose || "Not specified",
          createdAt: request.created_at,
          deadline: request.deadline,
          hasContributed,
          hasVoted,
          userVote,
          votes: votesArray,
          status: request.status
        };
      });
    
    setVoteRequests(formattedRequests);
  };
  
  const handleVote = (requestId: string, voteValue: 'approve' | 'reject') => {
    vote(requestId, voteValue);
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <Card className="glass-card animate-slide-up">
          <CardHeader>
            <CardTitle>Withdrawal Requests</CardTitle>
            <CardDescription>Vote on pending withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            {voteRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No withdrawal requests available.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {voteRequests.map(request => (
                  <Card key={request.requestId} className={`overflow-hidden ${
                    request.status === 'pending' 
                      ? 'border-amber-200 dark:border-amber-800' 
                      : request.status === 'approved' 
                        ? 'border-green-200 dark:border-green-800' 
                        : request.status === 'expired'
                          ? 'border-gray-200 dark:border-gray-800'
                          : 'border-red-200 dark:border-red-800'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="font-semibold mb-1 flex flex-wrap items-center gap-2">
                            <span>₦{request.amount.toLocaleString()}</span>
                            <Badge className="ml-0 md:ml-2" variant={
                              request.status === 'pending' 
                                ? 'outline' 
                                : request.status === 'approved' 
                                  ? 'default' 
                                  : request.status === 'expired'
                                    ? 'secondary'
                                    : 'destructive'
                            }>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{request.purpose}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested: {formatDate(request.createdAt)}
                          </p>
                          <p className="text-sm font-medium mt-1">
                            {request.contributionName}
                          </p>
                        </div>
                        
                        <div className="flex md:flex-col justify-between items-center md:items-end gap-2">
                          {request.status === 'pending' && request.deadline && (
                            <CountdownTimer 
                              deadline={request.deadline} 
                              size={isMobile ? "sm" : "md"}
                              showLabel={false}
                            />
                          )}
                          
                          <div className="text-right text-sm">
                            <p className="font-medium">
                              {request.votes.length} votes
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {request.hasContributed ? (
                        request.hasVoted ? (
                          <div className="mt-4 text-sm text-center p-2 bg-muted rounded-md">
                            You voted to {request.userVote === 'approve' ? 'approve' : 'reject'} this request.
                          </div>
                        ) : request.status === 'pending' ? (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button onClick={() => handleVote(request.requestId, 'approve')} className="flex-1 bg-green-600 hover:bg-green-700" size="sm">
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button onClick={() => handleVote(request.requestId, 'reject')} variant="outline" className="flex-1" size="sm">
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        ) : null
                      ) : (
                        <div className="mt-2 text-xs text-amber-500 text-center">
                          You must contribute to the group to vote
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <MobileNav />
    </div>
  );
};

export default VotesPage;
