import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Calendar, Share2, Send, Copy, ArrowUp, ArrowDown, Check, X, HelpCircle, UserCheck, Eye, EyeOff, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/contexts/AppContext";
import { Contribution, WithdrawalRequest, Transaction, hasContributed } from "@/services/localStorage";
import { format } from "date-fns";
import { toast } from "sonner";
import ShareContribution from "@/components/contributions/ShareContribution";
const GroupDetail = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    contributions,
    withdrawalRequests,
    transactions,
    user,
    contribute,
    requestWithdrawal,
    vote,
    getShareLink
  } = useApp();
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributionRequests, setContributionRequests] = useState<WithdrawalRequest[]>([]);
  const [contributionTransactions, setContributionTransactions] = useState<Transaction[]>([]);
  const [contributionAmount, setContributionAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalPurpose, setWithdrawalPurpose] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [anonymous, setAnonymous] = useState(user.preferences?.anonymousContributions || false);
  const [hasUserContributed, setHasUserContributed] = useState(false);
  useEffect(() => {
    if (!id) return;
    const foundContribution = contributions.find(c => c.id === id);
    if (!foundContribution) {
      toast.error("Contribution group not found");
      navigate("/dashboard");
      return;
    }
    setContribution(foundContribution);
    setContributionRequests(withdrawalRequests.filter(w => w.contributionId === id));
    setContributionTransactions(transactions.filter(t => t.contributionId === id));
    setShareLink(getShareLink(id));

    // Check if user has contributed to this group
    setHasUserContributed(hasContributed(user.id, id));
  }, [id, contributions, withdrawalRequests, transactions, navigate, getShareLink, user.id]);
  if (!contribution) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  const progressPercentage = Math.min(100, Math.round(contribution.currentAmount / contribution.targetAmount * 100));
  const handleContribute = () => {
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    contribute(contribution.id, Number(contributionAmount), anonymous);
    setContributionAmount("");
    setHasUserContributed(true);
  };
  const handleRequestWithdrawal = () => {
    if (!withdrawalAmount || isNaN(Number(withdrawalAmount)) || Number(withdrawalAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(withdrawalAmount) > contribution.currentAmount) {
      toast.error("Requested amount exceeds available funds");
      return;
    }
    if (!withdrawalPurpose.trim()) {
      toast.error("Please enter a purpose for the withdrawal");
      return;
    }
    requestWithdrawal({
      contributionId: contribution.id,
      requesterId: user.id,
      amount: Number(withdrawalAmount),
      purpose: withdrawalPurpose
    });
    setWithdrawalAmount("");
    setWithdrawalPurpose("");
  };
  const handleVote = (requestId: string, voteValue: 'approve' | 'reject') => {
    if (!hasUserContributed) {
      toast.error("You must contribute to this group before voting");
      return;
    }
    vote(requestId, voteValue);
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopySuccess(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMMM d, yyyy');
  };
  const hasVoted = (request: WithdrawalRequest) => {
    return request.votes.some(v => v.userId === user.id);
  };
  const userVote = (request: WithdrawalRequest) => {
    const vote = request.votes.find(v => v.userId === user.id);
    return vote ? vote.vote : null;
  };
  return <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6 animate-fade-in">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{contribution.name}</h1>
              <p className="text-muted-foreground">{contribution.description}</p>
            </div>
            
            {/* Share contribution component */}
            {contribution && <ShareContribution contributionId={contribution.id} contributionName={contribution.name} />}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="glass-card animate-slide-up">
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>Contribution goal progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">₦{contribution.currentAmount.toLocaleString()}</span>
                    <span className="text-muted-foreground">₦{contribution.targetAmount.toLocaleString()}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <p className="text-xs text-right text-muted-foreground">{progressPercentage}% Funded</p>
                </div>
                
                <div className="pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium capitalize">{contribution.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium capitalize">{contribution.frequency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">{formatDate(contribution.startDate)}</span>
                  </div>
                  {contribution.endDate && <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">End Date</span>
                      <span className="font-medium">{formatDate(contribution.endDate)}</span>
                    </div>}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Contribution</span>
                    <span className="font-medium">₦{contribution.contributionAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{contribution.members.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Voting Threshold</span>
                    <span className="font-medium">{contribution.votingThreshold}%</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-[#42ab35]">Contribute</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Make a Contribution</DialogTitle>
                      <DialogDescription>
                        Enter the amount you want to contribute to this group.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="contribution-amount">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                          <Input id="contribution-amount" type="number" className="pl-8" placeholder="0.00" value={contributionAmount} onChange={e => setContributionAmount(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="anonymous" checked={anonymous} onCheckedChange={checked => setAnonymous(checked as boolean)} />
                        <label htmlFor="anonymous" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Contribute anonymously
                        </label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setContributionAmount("")}>Cancel</Button>
                      <Button onClick={handleContribute}>Contribute</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">Request Withdrawal</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Fund Withdrawal</DialogTitle>
                      <DialogDescription>
                        Submit a request to withdraw funds. All members will vote on this request.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="withdrawal-amount">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                          <Input id="withdrawal-amount" type="number" className="pl-8" placeholder="0.00" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="withdrawal-purpose">Purpose</Label>
                        <Textarea id="withdrawal-purpose" placeholder="Explain why you're requesting these funds" rows={3} value={withdrawalPurpose} onChange={e => setWithdrawalPurpose(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                      setWithdrawalAmount("");
                      setWithdrawalPurpose("");
                    }}>Cancel</Button>
                      <Button onClick={handleRequestWithdrawal}>Submit Request</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Tabs defaultValue="withdrawals" className="w-full">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
                <TabsTrigger value="contributors">Contributors</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="withdrawals">
                <Card className="glass-card animate-slide-up">
                  <CardHeader>
                    <CardTitle>Withdrawal Requests</CardTitle>
                    <CardDescription>Vote on pending withdrawal requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contributionRequests.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        <p>No withdrawal requests yet.</p>
                      </div> : <div className="space-y-4">
                        {contributionRequests.map(request => <Card key={request.id} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-semibold mb-1">
                                    ₦{request.amount.toLocaleString()}
                                    <Badge className="ml-2" variant={request.status === 'pending' ? 'outline' : request.status === 'approved' ? 'default' : 'destructive'}>
                                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{request.purpose}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Requested: {formatDate(request.createdAt)}
                                  </p>
                                </div>
                                <div className="text-right text-sm">
                                  <p className="font-medium">
                                    {request.votes.length} / {contribution.members.length} votes
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {request.votes.filter(v => v.vote === 'approve').length} approvals needed
                                  </p>
                                </div>
                              </div>
                              
                              {request.status === 'pending' && !hasVoted(request) ? <div className="flex space-x-2 mt-4">
                                  <Button onClick={() => handleVote(request.id, 'approve')} className="flex-1" size="sm" disabled={!hasUserContributed}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button onClick={() => handleVote(request.id, 'reject')} variant="outline" className="flex-1" size="sm" disabled={!hasUserContributed}>
                                    <X className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div> : request.status === 'pending' && hasVoted(request) ? <div className="mt-4 text-sm text-center p-2 bg-muted rounded-md">
                                  You voted to {userVote(request) === 'approve' ? 'approve' : 'reject'} this request.
                                </div> : null}
                              
                              {request.status === 'pending' && !hasUserContributed && <div className="mt-2 text-xs text-amber-500 text-center">
                                  You must contribute to this group before you can vote
                                </div>}
                            </CardContent>
                          </Card>)}
                      </div>}
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Contributors tab content */}
              <TabsContent value="contributors">
                <Card className="glass-card animate-slide-up">
                  <CardHeader>
                    <CardTitle>Contributors</CardTitle>
                    <CardDescription>People who have contributed to this group</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contribution.contributors && contribution.contributors.length > 0 ? <div className="space-y-4">
                        {contribution.contributors.map((contributor, index) => <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center">
                              {contributor.anonymous ? <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  <EyeOff size={16} />
                                </div> : <Avatar className="w-10 h-10">
                                  <AvatarFallback>
                                    {contributor.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>}
                              <div className="ml-3">
                                <p className="font-medium text-sm">
                                  {contributor.anonymous ? 'Anonymous Contributor' : contributor.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(contributor.date), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-500">
                                ₦{contributor.amount.toLocaleString()}
                              </p>
                            </div>
                          </div>)}
                      </div> : <div className="text-center py-8 text-muted-foreground">
                        <p>No contributors yet.</p>
                      </div>}
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Transactions tab content */}
              <TabsContent value="transactions">
                <Card className="glass-card animate-slide-up">
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>All transactions for this contribution group</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {contributionTransactions.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                        <p>No transactions yet.</p>
                      </div> : <div className="space-y-4">
                        {contributionTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(transaction => <div key={transaction.id} className="flex items-start py-3 border-b last:border-b-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                ${transaction.type === 'deposit' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : transaction.type === 'withdrawal' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                                {transaction.type === 'deposit' ? <ArrowDown size={18} /> : transaction.type === 'withdrawal' ? <ArrowUp size={18} /> : <HelpCircle size={18} />}
                              </div>
                              <div className="ml-3 flex-1">
                                <div className="flex justify-between">
                                  <div>
                                    <h4 className="font-medium text-sm">
                                      {transaction.type === 'deposit' ? 'Contribution' : transaction.type === 'withdrawal' ? 'Fund Withdrawal' : 'Vote'}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {transaction.description}
                                      {transaction.anonymous && ' (Anonymous)'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className={`font-medium ${transaction.type === 'deposit' ? 'text-green-500' : ''}`}>
                                      {transaction.type === 'deposit' ? '+' : transaction.type === 'withdrawal' ? '-' : ''}
                                      ₦{transaction.amount.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(transaction.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                {transaction.status && <div className="mt-2">
                                    <Badge variant={transaction.status === 'pending' ? 'outline' : transaction.status === 'completed' ? 'default' : 'destructive'}>
                                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                                    </Badge>
                                  </div>}
                              </div>
                            </div>)}
                      </div>}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      
      <MobileNav />
    </div>;
};
export default GroupDetail;