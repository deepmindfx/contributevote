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
import { ArrowLeft, Users, Calendar, Share2, Send, Copy, ArrowUp, ArrowDown, Check, X, HelpCircle, UserCheck, Eye, EyeOff, UserIcon, Bell, Clock, Wallet, Receipt } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/contexts/AppContext";
import { Contribution, WithdrawalRequest, Transaction, hasContributed } from "@/services/localStorage";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { toast } from "sonner";
import ShareContribution from "@/components/contributions/ShareContribution";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import { ensureAccountNumberDisplay } from "@/localStorage";

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
    getShareLink,
    isGroupCreator,
    pingMembersForVote,
    getReceipt
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
  const [showCopiedAccountNumber, setShowCopiedAccountNumber] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  
  useEffect(() => {
    if (!id) return;
    const foundContribution = contributions.find(c => c.id === id);
    if (!foundContribution) {
      toast.error("Contribution group not found");
      navigate("/dashboard");
      return;
    }
    
    // Ensure account numbers are displayed
    ensureAccountNumberDisplay();
    
    // Set contribution and other related data
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
  
  const copyAccountNumber = () => {
    navigator.clipboard.writeText(contribution.accountNumber).then(() => {
      setShowCopiedAccountNumber(true);
      toast.success("Account number copied to clipboard");
      setTimeout(() => setShowCopiedAccountNumber(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy account number");
    });
  };
  
  const handlePingMembers = (requestId: string) => {
    pingMembersForVote(requestId);
  };
  
  const handleViewReceipt = (transactionId: string) => {
    const receipt = getReceipt(transactionId);
    if (receipt) {
      setReceiptData(receipt);
      setSelectedTransactionId(transactionId);
    } else {
      toast.error("Could not generate receipt for this transaction");
    }
  };
  
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
  
  const formatDeadline = (deadlineString: string) => {
    try {
      const deadlineDate = new Date(deadlineString);
      if (!isValid(deadlineDate)) {
        return "Invalid deadline";
      }
      
      const now = new Date();
      if (deadlineDate > now) {
        return `Ends in ${formatDistanceToNow(deadlineDate)}`;
      } else {
        return 'Voting ended';
      }
    } catch (error) {
      console.error("Error formatting deadline:", error, deadlineString);
      return "Invalid deadline";
    }
  };
  
  const hasVoted = (request: WithdrawalRequest) => {
    return request.votes.some(v => v.userId === user.id);
  };
  
  const userVote = (request: WithdrawalRequest) => {
    const vote = request.votes.find(v => v.userId === user.id);
    return vote ? vote.vote : null;
  };
  
  const isUserCreator = isGroupCreator(contribution.id);
  
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
        
        {/* Group Wallet Card - New Design */}
        <Card className="glass-card mb-6 animate-slide-up border-2 border-green-100 dark:border-green-900">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-lg">Group Wallet</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">CollectiPay</p>
                    <Badge variant="outline" className="text-xs">
                      {contribution?.category}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="text-center md:text-right">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ₦{contribution?.currentAmount.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  of ₦{contribution?.targetAmount.toLocaleString()} goal ({progressPercentage}%)
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <Progress value={progressPercentage} className="h-2" />
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              {/* Use the new AccountNumberDisplay component */}
              <AccountNumberDisplay 
                accountNumber={contribution?.accountNumber || ''} 
                accountName={contribution?.name || ''}
              />
              
              <div className="space-y-2">
                <span className="text-sm font-medium">Group Details</span>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className="capitalize">{contribution?.frequency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Members</span>
                  <span>{contribution?.members.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Started</span>
                  <span>{formatDate(contribution?.startDate)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-[#2dae75]">
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Contribute
                  </Button>
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
                    <Button onClick={handleContribute} className="bg-green-600 hover:bg-green-700">Contribute</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {isUserCreator && <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Request Withdrawal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Fund Withdrawal</DialogTitle>
                      <DialogDescription>
                        Submit a request to withdraw funds. All contributors will vote on this request within 24 hours.
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
                      <Button onClick={handleRequestWithdrawal} className="bg-green-600 hover:bg-green-700">Submit Request</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>}
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
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
                  <CardDescription>Vote on pending withdrawal requests (51% approval threshold)</CardDescription>
                </CardHeader>
                <CardContent>
                  {contributionRequests.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                      <p>No withdrawal requests yet.</p>
                    </div> : <div className="space-y-4">
                      {contributionRequests.map(request => <Card key={request.id} className={`overflow-hidden ${request.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : request.status === 'approved' ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
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
                                {request.status === 'pending' && request.deadline && <div className="flex items-center mt-1 text-xs text-amber-500">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDeadline(request.deadline)}
                                  </div>}
                              </div>
                              <div className="text-right text-sm">
                                <p className="font-medium">
                                  {request.votes.length} / {contribution.members.filter(m => hasContributed(m, contribution.id)).length} votes
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  51% approval needed
                                </p>
                              </div>
                            </div>
                            
                            {request.status === 'pending' && !hasVoted(request) ? <div className="flex space-x-2 mt-4">
                                <Button onClick={() => handleVote(request.id, 'approve')} className="flex-1 bg-green-600 hover:bg-green-700" size="sm" disabled={!hasUserContributed}>
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
                            
                            {request.status === 'pending' && hasUserContributed && <div className="mt-2 flex justify-center">
                                <Button variant="ghost" size="sm" className="text-xs" onClick={() => handlePingMembers(request.id)}>
                                  <Bell className="h-3 w-3 mr-1 text-green-600" />
                                  Remind others to vote
                                </Button>
                              </div>}
                            
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
                                  {contributor.name ? contributor.name.charAt(0).toUpperCase() : 'U'}
                                </AvatarFallback>
                              </Avatar>}
                            <div className="ml-3">
                              <p className="font-medium text-sm">
                                {contributor.anonymous ? 'Anonymous Contributor' : contributor.name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {contributor.date ? formatDate(contributor.date) : 'Unknown date'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
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
                      {contributionTransactions
                        .sort((a, b) => {
                          try {
                            const dateA = new Date(a.createdAt);
                            const dateB = new Date(b.createdAt);
                            if (!isValid(dateA) || !isValid(dateB)) {
                              console.error("Invalid date in transaction sort:", a.createdAt, b.createdAt);
                              return 0;
                            }
                            return dateB.getTime() - dateA.getTime();
                          } catch (error) {
                            console.error("Error sorting transactions:", error);
                            return 0;
                          }
                        })
                        .map(transaction => <div key={transaction.id} className="flex items-start py-3 border-b last:border-b-0">
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
                                    {transaction.createdAt ? formatDate(transaction.createdAt) : 'Unknown date'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
                                {transaction.status && <Badge variant={transaction.status === 'pending' ? 'outline' : transaction.status === 'completed' ? 'default' : 'destructive'}>
                                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                                  </Badge>}
                                
                                {transaction.type === 'deposit' && <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleViewReceipt(transaction.id)}>
                                    <Receipt className="h-3 w-3 mr-1" />
                                    View Receipt
                                  </Button>}
                              </div>
                            </div>
                          </div>)}
                    </div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {/* Receipt Dialog */}
      {receiptData && <Dialog open={!!selectedTransactionId} onOpenChange={() => setSelectedTransactionId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Transaction Receipt</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-muted/30 rounded-lg space-y-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">CollectiPay</h3>
                <p className="text-sm text-muted-foreground">Official Contribution Receipt</p>
              </div>
              
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Receipt No:</span>
                  <span className="font-mono">{receiptData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span>{receiptData.date ? formatDate(receiptData.date) : 'Unknown date'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Group:</span>
                  <span>{receiptData.contributionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account No:</span>
                  <span className="font-mono">{receiptData.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Contributor:</span>
                  <span>{receiptData.contributorName}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Amount:</span>
                  <span className="text-green-600">₦{receiptData.amount.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="text-center text-xs text-muted-foreground mt-6 pt-2 border-t">
                <p>Thank you for your contribution!</p>
                <p>For any inquiries, please contact support@collectipay.com</p>
              </div>
            </div>
            <DialogFooter className="flex justify-center">
              <Button variant="outline">
                Download Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      
      <MobileNav />
    </div>;
};

export default GroupDetail;
