import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, HelpCircle, Wallet, Building, ExternalLink, Users, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { format, isValid, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define interface for Monnify transaction
interface MonnifyTransaction {
  amount: number;
  paymentReference: string;
  transactionReference: string;
  paymentMethod: string;
  paidOn: string;
  paymentStatus: string;
  destinationAccountName: string;
  destinationBankName: string;
  destinationAccountNumber: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  payerBankCode?: string;
  payerBankName?: string;
}

const WalletHistory = () => {
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { transactions, refreshContributions } = useSupabaseContribution();
  
  // Define refreshData function
  const refreshData = async () => {
    try {
      await Promise.all([
        refreshCurrentUser(),
        refreshContributions()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "vote">("all");
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [apiTransactions, setApiTransactions] = useState<MonnifyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"app" | "bank">("app");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  
  // Fetch group names for transactions with contribution_id
  useEffect(() => {
    const fetchGroupNames = async () => {
      const contributionIds = transactions
        .filter(t => t.contribution_id)
        .map(t => t.contribution_id);
      
      if (contributionIds.length === 0) return;
      
      try {
        const { data: groups } = await supabase
          .from('contribution_groups')
          .select('id, name')
          .in('id', contributionIds);
        
        if (groups) {
          const names: Record<string, string> = {};
          groups.forEach(g => {
            names[g.id] = g.name;
          });
          setGroupNames(names);
        }
      } catch (error) {
        console.error('Error fetching group names:', error);
      }
    };
    
    fetchGroupNames();
  }, [transactions]);
  
  // Fetch reserved account transactions on component mount and when tab changes
  useEffect(() => {
    const fetchReservedAccountTransactions = async () => {
      if (user?.reservedAccount?.accountReference) {
        setIsLoading(true);
        try {
          const result = await getReservedAccountTransactions(user.reservedAccount.accountReference);
          if (result) {
            // If result is an array, use it directly
            setApiTransactions(Array.isArray(result) ? result : []);
            // After fetching transactions, refresh app data to update balances
            await refreshData();
          } else {
            // Handle empty or failed response
            setApiTransactions([]);
          }
        } catch (error) {
          console.error("Error fetching reserved account transactions:", error);
          setApiTransactions([]);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    if (activeTab === "bank") {
      fetchReservedAccountTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.reservedAccount?.accountReference, activeTab]);
  
  // Fixed toggle currency function
  const toggleCurrency = () => {
    setCurrencyType(prevType => prevType === "NGN" ? "USD" : "NGN");
  };
  
  // Filter and deduplicate transactions
  const uniqueFilteredTransactions = useMemo(() => {
    const seen = new Map();
    
    return transactions
      .filter(t => t.user_id === user?.id) // Only show current user's transactions (using snake_case)
      .filter(t => filter === "all" || t.type === filter)
      .filter(transaction => {
        // Create a unique key based on multiple identifiers
        const key = transaction.metadata?.paymentReference || 
                   transaction.metadata?.paymentDetails?.transactionId ||
                   transaction.metadata?.transactionReference ||
                   transaction.id;

        // If we've seen this key before, it's a duplicate
        if (seen.has(key)) {
          return false;
        }
        
        // Add the transaction to our seen map
        seen.set(key, true);
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
      });
  }, [transactions, user?.id, filter]);
  
  // Improved formatDate function with proper error handling
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      // First try with parseISO which is more reliable for ISO strings
      const parsedDate = parseISO(dateString);
      if (!isValid(parsedDate)) {
        // If parseISO fails, try with regular Date constructor
        const fallbackDate = new Date(dateString);
        if (!isValid(fallbackDate)) {
          return "Invalid date";
        }
        return format(fallbackDate, 'MMM d, yyyy h:mm a');
      }
      return format(parsedDate, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };
  
  // Helper to get metadata field (handles both camelCase and snake_case)
  const getMetadata = (transaction: any) => {
    return transaction.metadata || transaction.metaData || {};
  };
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
  // View transaction details
  const viewTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsOpen(true);
  };
  
  // Find sender name if available
  const getSenderName = (transaction: any) => {
    const meta = getMetadata(transaction);
    if (transaction.type === 'deposit') {
      return meta?.senderName || transaction.senderName || "Bank Transfer";
    } else {
      return "Wallet Withdrawal";
    }
  };
  
  // Get sender bank if available
  const getSenderBank = (transaction: any) => {
    const meta = getMetadata(transaction);
    return meta?.bankName || meta?.senderBank || "";
  };
  
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
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all your wallet transactions</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "app" | "bank")} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="app">
              <Wallet className="h-4 w-4 mr-2" />
              App Transactions
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Building className="h-4 w-4 mr-2" />
              Bank Transactions
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="app" className="m-0 mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={filter === "all" ? "default" : "outline"} 
                  onClick={() => setFilter("all")}
                  size="sm"
                  className={filter === "all" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
                >
                  All
                </Button>
                <Button 
                  variant={filter === "deposit" ? "default" : "outline"} 
                  onClick={() => setFilter("deposit")}
                  size="sm"
                  className={filter === "deposit" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
                >
                  Deposits
                </Button>
                <Button 
                  variant={filter === "withdrawal" ? "default" : "outline"} 
                  onClick={() => setFilter("withdrawal")}
                  size="sm"
                  className={filter === "withdrawal" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
                >
                  Withdrawals
                </Button>
                <Button 
                  variant={filter === "vote" ? "default" : "outline"} 
                  onClick={() => setFilter("vote")}
                  size="sm"
                  className={filter === "vote" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
                >
                  Votes
                </Button>
              </div>
              
              {/* Currency Toggle - Fixed to work correctly */}
              <div className="flex items-center bg-green-600/30 dark:bg-green-600/50 rounded-full px-3 py-1.5 cursor-pointer" onClick={toggleCurrency}>
                <span className={`text-xs ${currencyType === 'NGN' ? 'text-foreground' : 'text-muted-foreground'}`}>NGN</span>
                <Switch 
                  checked={currencyType === "USD"}
                  onCheckedChange={toggleCurrency}
                  className="mx-1.5 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-green-500"
                />
                <span className={`text-xs ${currencyType === 'USD' ? 'text-foreground' : 'text-muted-foreground'}`}>USD</span>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>
                  {filter === "all" 
                    ? "All transactions" 
                    : filter === "deposit" 
                      ? "Deposit transactions" 
                      : filter === "withdrawal" 
                        ? "Withdrawal transactions" 
                        : "Vote transactions"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uniqueFilteredTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {uniqueFilteredTransactions.map(transaction => {
                      const meta = getMetadata(transaction);
                      return (
                      <div 
                        key={`${transaction.id}-${meta?.paymentReference || ''}`}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => viewTransactionDetails(transaction)}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center
                          ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 
                            transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'}`}>
                          {transaction.type === 'deposit' ? (
                            <ArrowDown size={18} />
                          ) : transaction.type === 'withdrawal' ? (
                            <ArrowUp size={18} />
                          ) : (
                            <HelpCircle size={18} />
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between">
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                {transaction.contribution_id && (
                                  <Users className="h-4 w-4 text-blue-600" />
                                )}
                                {transaction.contribution_id 
                                  ? `Contribution to ${groupNames[transaction.contribution_id] || 'Group'}`
                                  : transaction.type === 'deposit' ? 'Wallet Deposit' : 
                                    transaction.type === 'withdrawal' ? 'Withdrawal' : 
                                    'Vote'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {transaction.description}
                              </p>
                              {!transaction.contribution_id && (meta?.senderName || getSenderBank(transaction)) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {meta?.senderName ? `From: ${meta.senderName}` : ""} 
                                  {getSenderBank(transaction) ? `${meta?.senderName ? " via " : "Via "} ${getSenderBank(transaction)}` : ""}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(transaction.created_at)}
                              </p>
                            </div>
                            <div className="text-right flex items-center">
                              <div className={`font-medium ${
                                transaction.type === 'deposit' ? 'text-[#2DAE75]' : 
                                transaction.type === 'withdrawal' ? 'text-red-500' : ''
                              }`}>
                                {transaction.type === 'deposit' ? '+' : 
                                transaction.type === 'withdrawal' ? '-' : ''}
                                {transaction.amount > 0 ? (
                                  currencyType === "NGN" ? 
                                    `₦${transaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 
                                    `$${convertToUSD(transaction.amount).toFixed(2)}`
                                ) : ''}
                              </div>
                              <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="mt-1">
                            <Badge variant={
                              transaction.status === 'pending' ? 'outline' :
                              transaction.status === 'completed' ? 'default' : 'destructive'
                            }>
                              {transaction.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) : 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No transactions found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="bank" className="m-0 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Transactions</CardTitle>
                <CardDescription>
                  Transactions processed through your virtual bank account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!user?.reservedAccount ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>You don't have a virtual bank account yet</p>
                    <Button 
                      className="mt-4"
                      onClick={() => navigate("/dashboard")}
                    >
                      Create Virtual Account
                    </Button>
                  </div>
                ) : isLoading ? (
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
                ) : apiTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No bank transactions found</p>
                    <Button
                      className="mt-4"
                      onClick={() => getReservedAccountTransactions(user.reservedAccount.accountReference).then(() => refreshData())}
                    >
                      Refresh Transactions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiTransactions.map((transaction) => (
                      <div key={transaction.transactionReference} className="flex items-start p-3 border rounded-lg">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 text-[#2DAE75]">
                          <ArrowDown size={18} />
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between">
                            <div>
                              <h4 className="font-medium">Bank Transfer</h4>
                              <p className="text-sm text-muted-foreground">
                                Via {transaction.paymentMethod}
                              </p>
                              {transaction.payerName && (
                                <p className="text-xs text-muted-foreground">
                                  From: {transaction.payerName} 
                                  {transaction.payerBankName ? ` (${transaction.payerBankName})` : ""}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(transaction.paidOn)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-[#2DAE75]">
                                +{currencyType === "NGN" ? 
                                  `₦${transaction.amount.toLocaleString()}` : 
                                  `$${convertToUSD(transaction.amount).toFixed(2)}`}
                              </div>
                              <div className="mt-1">
                                <Badge variant={
                                  transaction.paymentStatus === 'PAID' ? 'default' :
                                  transaction.paymentStatus === 'PENDING' ? 'outline' : 'destructive'
                                }>
                                  {transaction.paymentStatus}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Transaction Details Dialog */}
      <Dialog open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information about this transaction.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center
                  ${selectedTransaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 
                    selectedTransaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'}`}>
                  {selectedTransaction.type === 'deposit' ? (
                    <ArrowDown size={24} />
                  ) : selectedTransaction.type === 'withdrawal' ? (
                    <ArrowUp size={24} />
                  ) : (
                    <HelpCircle size={24} />
                  )}
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className={`text-2xl font-bold ${
                  selectedTransaction.type === 'deposit' ? 'text-[#2DAE75]' : 
                  selectedTransaction.type === 'withdrawal' ? 'text-red-500' : ''
                }`}>
                  {selectedTransaction.type === 'deposit' ? '+' : 
                  selectedTransaction.type === 'withdrawal' ? '-' : ''}
                  ₦{selectedTransaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formatDate(selectedTransaction.created_at)}
                </p>
              </div>
              
              <div className="space-y-3">
                {(selectedTransaction.metaData?.balance_before !== undefined || selectedTransaction.metadata?.balance_before !== undefined) && (
                   <div className="py-2 border-b bg-slate-50 dark:bg-slate-900 px-3 -mx-3 rounded mb-2">
                    <p className="text-xs text-muted-foreground mb-1">Wallet Balance</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        ₦{(selectedTransaction.metaData?.balance_before ?? selectedTransaction.metadata?.balance_before).toLocaleString()}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground mx-2" />
                      <span className="font-medium">
                        ₦{(selectedTransaction.metaData?.balance_after ?? selectedTransaction.metadata?.balance_after).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{selectedTransaction.status || 'Unknown'}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{selectedTransaction.type || 'Unknown'}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-medium">{selectedTransaction.id ? selectedTransaction.id.slice(0, 8) : 'N/A'}</span>
                </div>
                
                {selectedTransaction.type === 'deposit' && (() => {
                  const meta = getMetadata(selectedTransaction);
                  return (
                  <>
                    {(meta?.senderName || getSenderName(selectedTransaction) !== "Bank Transfer") && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Sender</span>
                        <span className="font-medium">{meta?.senderName || getSenderName(selectedTransaction)}</span>
                      </div>
                    )}
                    
                    {getSenderBank(selectedTransaction) && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{getSenderBank(selectedTransaction)}</span>
                      </div>
                    )}
                    
                    {meta?.payerEmail && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{meta.payerEmail}</span>
                      </div>
                    )}
                    
                    {meta?.transactionReference && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="font-medium">{meta.transactionReference}</span>
                      </div>
                    )}
                  </>
                )})()}
                
                {selectedTransaction.contribution_id && (
                  <div className="flex justify-between py-2 border-b bg-blue-50 dark:bg-blue-950/20 px-3 -mx-3 rounded">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Group Contribution
                    </span>
                    <span className="font-medium">{groupNames[selectedTransaction.contribution_id] || "Group Transaction"}</span>
                  </div>
                )}
                
                {selectedTransaction.description && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium">{selectedTransaction.description}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsTransactionDetailsOpen(false);
              }}
              type="button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default WalletHistory;
