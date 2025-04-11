import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Wallet, 
  ArrowLeft, 
  Users, 
  Calendar, 
  BarChart, 
  Settings,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import Header from "@/components/layout/Header";
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getGroupAccountTransactions } from "@/services/groupAccounts";

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    contributions, 
    users, 
    transactions, 
    refreshData, 
    isGroupCreator,
    withdrawalRequests,
    requestWithdrawal,
    vote,
    pingMembersForVote
  } = useApp();
  const [contribution, setContribution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  const [withdrawalDescription, setWithdrawalDescription] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const navigate = useNavigate();
  
  // Add state for transaction refresh
  const [refreshingTransactions, setRefreshingTransactions] = useState(false);
  
  useEffect(() => {
    if (id) {
      const foundContribution = contributions.find(c => c.id === id);
      setContribution(foundContribution);
      setIsCreator(foundContribution ? isGroupCreator(foundContribution.id) : false);
      setLoading(false);
    }
  }, [id, contributions, isGroupCreator]);
  
  // Add effect to check for account transactions
  useEffect(() => {
    if (contribution?.accountNumber && isGroupCreator(contribution.id)) {
      // Check for transactions on group account only for the creator
      const checkGroupTransactions = async () => {
        await getGroupAccountTransactions(contribution.id);
        // Refresh data to get updated contributions
        refreshData();
      };
      
      checkGroupTransactions();
    }
  }, [contribution?.id]);
  
  if (!contribution) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center p-4 pt-24">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <Wallet className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-4">Contribution Not Found</CardTitle>
              <CardDescription>
                The contribution you're looking for doesn't exist or may have been deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              Please check the URL or return to the dashboard.
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link to="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }
  
  const getMemberCount = () => {
    return contribution?.members?.length || 0;
  };
  
  const getDaysRemaining = () => {
    if (!contribution.deadline) return 'No deadline';
    const deadline = new Date(contribution.deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? `${days} days remaining` : 'Deadline passed';
  };
  
  const getContributionTransactions = () => {
    return transactions.filter(t => t.contributionId === contribution.id);
  };
  
  const getWithdrawalRequestsForContribution = () => {
    return withdrawalRequests.filter(wr => wr.contributionId === contribution.id);
  };
  
  const handleOpenAlertDialog = () => {
    setIsAlertDialogOpen(true);
  };
  
  const handleCloseAlertDialog = () => {
    setIsAlertDialogOpen(false);
    setWithdrawalAmount(0);
    setWithdrawalDescription('');
  };
  
  const handleWithdrawalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setWithdrawalAmount(isNaN(value) ? 0 : value);
  };
  
  const handleWithdrawalDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setWithdrawalDescription(e.target.value);
  };
  
  const handleRequestWithdrawal = async () => {
    if (withdrawalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (withdrawalAmount > contribution.currentAmount) {
      toast.error('Amount exceeds available balance');
      return;
    }
    
    if (!withdrawalDescription) {
      toast.error('Please enter a description for the withdrawal');
      return;
    }
    
    setIsSubmittingWithdrawal(true);
    
    // Set a deadline for voting (e.g., 72 hours from now)
    const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    // Call the requestWithdrawal function
    requestWithdrawal({
      contributionId: contribution.id,
      amount: withdrawalAmount,
      description: withdrawalDescription,
      recipientName: contribution.name,
      recipientAccount: contribution.accountNumber,
      recipientBank: contribution.bankName,
      deadline: deadline
    });
    
    setIsSubmittingWithdrawal(false);
    handleCloseAlertDialog();
    toast.success('Withdrawal request submitted successfully');
  };
  
  const handleVote = (requestId: string, voteType: 'approve' | 'reject') => {
    vote(requestId, voteType);
  };
  
  // Add function to manually refresh transactions
  const handleRefreshTransactions = async () => {
    if (!contribution) return;
    
    setRefreshingTransactions(true);
    toast.info("Checking for new transactions...");
    
    try {
      await getGroupAccountTransactions(contribution.id);
      refreshData();
      toast.success("Transaction list updated");
    } catch (error) {
      console.error("Error refreshing transactions:", error);
      toast.error("Failed to refresh transactions");
    } finally {
      setRefreshingTransactions(false);
    }
  };
  
  // Add function to copy account number to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  
  // The rendering part of the component where we add the account details
  return (
    <div className="min-h-screen pb-20">
      <Header />
      <div className="container max-w-5xl mx-auto px-4 pt-24">
        {loading ? (
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <Wallet className="mx-auto h-12 w-12 animate-pulse text-muted-foreground" />
              <CardTitle className="mt-4">Loading...</CardTitle>
              <CardDescription>
                Fetching contribution details. Please wait.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : contribution ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">
                  {contribution.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created on {format(new Date(contribution.createdAt), 'MMM dd, yyyy')}
                </p>
              </div>
              <Button variant="ghost" asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Dashboard
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>About this Contribution</CardTitle>
                    <CardDescription>
                      {contribution.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{contribution.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{contribution.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {contribution.category}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-1">Contribution Progress</p>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full"
                          style={{ 
                            width: `${Math.min(
                              (contribution.currentAmount / contribution.targetAmount) * 100, 
                              100
                            )}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span>₦{contribution.currentAmount.toLocaleString()}</span>
                        <span>₦{contribution.targetAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Members</p>
                        <p className="text-3xl font-bold">{getMemberCount()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Deadline</p>
                        <p className="text-3xl font-bold">{getDaysRemaining()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Add account details section */}
                {contribution.accountNumber && (
                  <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                    <h3 className="text-lg font-medium mb-2">Group Account Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Account Number</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contribution.accountNumber}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => copyToClipboard(contribution.accountNumber || "")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bank Name</p>
                        <p className="font-medium">{contribution.bankName}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Anyone can contribute to this group by transferring funds to this account.
                    </p>
                    {isGroupCreator(contribution.id) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-3"
                        onClick={handleRefreshTransactions}
                        disabled={refreshingTransactions}
                      >
                        {refreshingTransactions ? (
                          <>
                            <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></span>
                            Refreshing...
                          </>
                        ) : (
                          "Check for new transactions"
                        )}
                      </Button>
                    )}
                  </div>
                )}
                
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>
                      All transactions related to this contribution group
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {getContributionTransactions().length > 0 ? (
                      <div className="divide-y divide-secondary">
                        {getContributionTransactions().map(transaction => (
                          <div key={transaction.id} className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  ₦{transaction.amount.toLocaleString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {transaction.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(transaction.createdAt), 'MMM dd, yyyy')}
                                </p>
                                <Badge variant="secondary">
                                  {transaction.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground">
                        No transactions yet
                      </p>
                    )}
                  </CardContent>
                </Card>
                
                {isCreator && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Withdrawal Requests</CardTitle>
                      <CardDescription>
                        Manage withdrawal requests for this contribution group
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {getWithdrawalRequestsForContribution().length > 0 ? (
                        <div className="divide-y divide-secondary">
                          {getWithdrawalRequestsForContribution().map(request => (
                            <div key={request.id} className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    ₦{request.amount.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {request.description}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-muted-foreground">
                                    Requested on {format(new Date(request.createdAt), 'MMM dd, yyyy')}
                                  </p>
                                  <Badge variant="secondary">
                                    {request.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              {/* Voting UI */}
                              {request.status === 'pending' && (
                                <div className="flex justify-end space-x-2 mt-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleVote(request.id, 'approve')}
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => handleVote(request.id, 'reject')}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground">
                          No withdrawal requests yet
                        </p>
                      )}
                      
                      {/* Request Withdrawal Button */}
                      <Button 
                        variant="outline" 
                        className="w-full mt-4"
                        onClick={handleOpenAlertDialog}
                      >
                        Request Withdrawal
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <div className="space-y-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Contribution Details</CardTitle>
                    <CardDescription>
                      Quick overview of this contribution group
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <p className="text-sm font-medium">{contribution.category}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Amount</Label>
                      <p className="text-sm font-medium">₦{contribution.targetAmount.toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Current Amount</Label>
                      <p className="text-sm font-medium">₦{contribution.currentAmount.toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Members</Label>
                      <p className="text-sm font-medium">{getMemberCount()}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Deadline</Label>
                      <p className="text-sm font-medium">{getDaysRemaining()}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Withdrawal Request Alert Dialog */}
            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request Withdrawal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Enter the amount you want to withdraw and a description for the request.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">
                      Amount
                    </Label>
                    <Input 
                      type="number" 
                      id="amount" 
                      value={withdrawalAmount || ''}
                      onChange={handleWithdrawalAmountChange}
                      className="col-span-3" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Textarea 
                      id="description" 
                      value={withdrawalDescription}
                      onChange={handleWithdrawalDescriptionChange}
                      className="col-span-3" 
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={handleCloseAlertDialog}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleRequestWithdrawal} disabled={isSubmittingWithdrawal}>
                    {isSubmittingWithdrawal ? (
                      <>
                        <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></span>
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <Wallet className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-4">Contribution Not Found</CardTitle>
              <CardDescription>
                The contribution you're looking for doesn't exist or may have been deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              Please check the URL or return to the dashboard.
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link to="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GroupDetail;
