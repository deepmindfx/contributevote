import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, XCircle, Vote, Timer, User, Check, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { createWithdrawalRequest, getContributionDetails, getWithdrawalRequests, submitVote } from "@/services/contributionIntegration";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

// Define the vote form schema
const voteFormSchema = z.object({
  purpose: z.string().min(3, {
    message: "Purpose must be at least 3 characters.",
  }),
  amount: z.string().refine((value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }, {
    message: "Amount must be a valid number greater than zero.",
  }),
});

// Define the interface for the vote form data
interface VoteFormData {
  purpose: string;
  amount: string;
}

// Define interface for vote details
interface VoteDetails {
  userId: string;
  vote: "approve" | "reject";
}

// Define interface for withdrawal requests
interface WithdrawalRequest {
  requestId: string;
  contributionId: string;
  contributionName: string;
  amount: number;
  purpose: string;
  createdAt: string;
  deadline: string; 
  hasContributed: boolean;
  hasVoted: boolean;
  userVote: "approve" | "reject";
  votes: VoteDetails[];
  status: "pending" | "rejected" | "approved" | "expired"; // Added 'expired' status
}

const Votes = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const [contribution, setContribution] = useState<any>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const contributionId = localStorage.getItem('contributionId');
  
  // Form state using react-hook-form
  const form = useForm<VoteFormData>({
    resolver: zodResolver(voteFormSchema),
    defaultValues: {
      purpose: "",
      amount: "",
    },
  });
  
  useEffect(() => {
    const fetchContributionAndRequests = async () => {
      if (!contributionId || !user) {
        navigate("/dashboard");
        return;
      }
      
      setIsLoading(true);
      try {
        const [contributionData, requestsData] = await Promise.all([
          getContributionDetails(contributionId),
          getWithdrawalRequests(contributionId)
        ]);
        
        setContribution(contributionData);
        setWithdrawalRequests(requestsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load contribution details.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchContributionAndRequests();
  }, [contributionId, user, navigate]);
  
  const handleOpenVoteModal = (request: WithdrawalRequest) => {
    setSelectedRequest(request);
    setIsVoteModalOpen(true);
  };
  
  const handleCloseVoteModal = () => {
    setIsVoteModalOpen(false);
    setSelectedRequest(null);
  };
  
  const handleOpenRequestModal = () => {
    setIsRequestModalOpen(true);
  };
  
  const handleCloseRequestModal = () => {
    setIsRequestModalOpen(false);
  };
  
  const handleVote = async (vote: "approve" | "reject") => {
    if (!selectedRequest || !user) return;
    
    setIsSubmitting(true);
    try {
      await submitVote(selectedRequest.requestId, user.id, vote);
      
      // Optimistically update the UI
      setWithdrawalRequests(prevRequests => {
        return prevRequests.map(req => {
          if (req.requestId === selectedRequest.requestId) {
            const updatedVotes = [...(req.votes || []), { userId: user.id, vote }];
            return { ...req, votes: updatedVotes, userVote: vote, hasVoted: true };
          }
          return req;
        });
      });
      
      toast.success(`Vote ${vote}d successfully!`);
    } catch (error) {
      console.error("Error submitting vote:", error);
      toast.error("Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting(false);
      handleCloseVoteModal();
    }
  };
  
  const onSubmit = async (values: VoteFormData) => {
    if (!contributionId || !user) return;
    
    setIsSubmitting(true);
    try {
      // Call the createWithdrawalRequest function
      await createWithdrawalRequest(
        contributionId,
        user.id,
        values.amount,
        values.purpose
      );
      
      // After successful request, fetch the updated list of requests
      const updatedRequests = await getWithdrawalRequests(contributionId);
      setWithdrawalRequests(updatedRequests);
      
      toast.success("Withdrawal request created successfully!");
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      toast.error("Failed to create withdrawal request. Please try again.");
    } finally {
      setIsSubmitting(false);
      handleCloseRequestModal();
      form.reset();
    }
  };
  
  const calculateVoteResults = (request: WithdrawalRequest) => {
    const totalVotes = request.votes.length;
    const approveVotes = request.votes.filter(vote => vote.vote === "approve").length;
    const rejectVotes = totalVotes - approveVotes;
    
    return {
      totalVotes,
      approveVotes,
      rejectVotes,
    };
  };
  
  const hasRequestExpired = (deadline: string) => {
    return new Date(deadline) < new Date();
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <Header />
        <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Loading...</h1>
            <p className="text-muted-foreground">Fetching contribution details</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>
                Loading withdrawal requests...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start p-3 border rounded-lg">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="ml-3 flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-5 w-20 mb-2" />
                      <Skeleton className="h-6 w-16 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
        <MobileNav />
      </div>
    );
  }
  
  if (!contribution) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <Header />
        <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Error</h1>
            <p className="text-muted-foreground">Failed to load contribution details</p>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left mr-2 h-4 w-4"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{contribution.name}</h1>
          <p className="text-muted-foreground">Manage withdrawal requests and vote</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Requests</CardTitle>
            <CardDescription>
              Vote on pending withdrawal requests or create a new request
            </CardDescription>
          </CardHeader>
          <CardContent>
            {withdrawalRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No withdrawal requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {withdrawalRequests.map((request) => {
                  const { totalVotes, approveVotes, rejectVotes } = calculateVoteResults(request);
                  const hasExpired = hasRequestExpired(request.deadline);
                  
                  let statusText = request.status;
                  if (hasExpired && request.status === 'pending') {
                    statusText = 'expired';
                  }
                  
                  return (
                    <div key={request.requestId} className="border rounded-lg">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <h4 className="font-medium">{request.purpose}</h4>
                          <p className="text-sm text-muted-foreground">
                            Amount: ₦{Number(request.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(request.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Deadline: {formatDate(request.deadline)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="mb-2">
                            {statusText === 'pending' && !hasExpired && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleOpenVoteModal(request)}
                                disabled={request.hasVoted}
                              >
                                {request.hasVoted ? "Voted" : "Vote"}
                              </Button>
                            )}
                          </div>
                          <div>
                            {statusText === 'pending' && hasExpired && (
                              <div className="text-xs text-amber-500">
                                <Timer className="inline-block h-4 w-4 mr-1" />
                                Expired
                              </div>
                            )}
                            {statusText === 'approved' && (
                              <div className="text-xs text-green-500">
                                <CheckCircle2 className="inline-block h-4 w-4 mr-1" />
                                Approved
                              </div>
                            )}
                            {statusText === 'rejected' && (
                              <div className="text-xs text-red-500">
                                <XCircle className="inline-block h-4 w-4 mr-1" />
                                Rejected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Accordion type="single" collapsible>
                        <AccordionItem value={request.requestId}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              <Vote className="h-4 w-4" />
                              View Votes ({totalVotes})
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h5 className="font-medium">Approve</h5>
                                <ul className="mt-2 space-y-1">
                                  {request.votes
                                    .filter(vote => vote.vote === "approve")
                                    .map(vote => (
                                      <li key={vote.userId} className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        {vote.userId === user.id ? "You" : `User ${vote.userId.slice(0, 6)}`}
                                      </li>
                                    ))}
                                  {approveVotes === 0 && (
                                    <li className="text-muted-foreground">No votes</li>
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h5 className="font-medium">Reject</h5>
                                <ul className="mt-2 space-y-1">
                                  {request.votes
                                    .filter(vote => vote.vote === "reject")
                                    .map(vote => (
                                      <li key={vote.userId} className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        {vote.userId === user.id ? "You" : `User ${vote.userId.slice(0, 6)}`}
                                      </li>
                                    ))}
                                  {rejectVotes === 0 && (
                                    <li className="text-muted-foreground">No votes</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  );
                })}
              </div>
            )}
            
            <Button variant="default" className="w-full mt-4" onClick={handleOpenRequestModal}>
              Create Withdrawal Request
            </Button>
          </CardContent>
        </Card>
      </main>
      
      {/* Vote Confirmation Dialog */}
      <Dialog open={isVoteModalOpen} onOpenChange={setIsVoteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Vote</DialogTitle>
            <DialogDescription>
              Are you sure you want to vote on this withdrawal request?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>
              <strong>Purpose:</strong> {selectedRequest?.purpose}
            </p>
            <p>
              <strong>Amount:</strong> ₦{Number(selectedRequest?.amount).toLocaleString()}
            </p>
            <p>
              <strong>Deadline:</strong> {formatDate(selectedRequest?.deadline)}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleCloseVoteModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleVote("approve")} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Approving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
            <Button type="button" variant="destructive" onClick={() => handleVote("reject")} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Request Withdrawal Dialog */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Create a new withdrawal request for this contribution.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <FormControl>
                      <Input placeholder="What is this withdrawal for?" {...field} />
                    </FormControl>
                    <FormDescription>
                      Briefly explain the purpose of this withdrawal.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (NGN)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the amount you wish to withdraw.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={handleCloseRequestModal} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Requesting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default Votes;
