import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ArrowDown, Wallet, SendHorizontal, UserPlus, Clock, Eye, EyeOff, DollarSign, CreditCard, Building, ExternalLink } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPaymentInvoice, getReservedAccountTransactions } from "@/services/walletIntegration";
import WalletActions from "@/components/dashboard/wallet/WalletActions";
import { useBalanceUpdates } from "@/hooks/useBalanceUpdates";

const WalletCard = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [depositMethod, setDepositMethod] = useState<"manual" | "card" | "bank">("manual");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  
  const { user, isAdmin, refreshCurrentUser } = useSupabaseUser();
  const { refreshBalance } = useBalanceUpdates();
  
  // Import transactions from context
  const { transactions } = useSupabaseContribution();
  const refreshData = async () => {
    await refreshCurrentUser();
  };
  
  // TODO: Load transaction history when component mounts
  useEffect(() => {
    // Will implement with Supabase
  }, [user]);
  
  const fetchTransactions = async () => {
    // TODO: Implement with Supabase
    setIsLoading(true);
    try {
      // Will fetch from Supabase transactions table
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle currency function - make the entire container clickable
  const toggleCurrency = () => {
    setCurrencyType(prev => prev === "NGN" ? "USD" : "NGN");
  };

  // Helper to get metadata field (handles both camelCase and snake_case)
  const getMetadata = (transaction: any) => {
    return transaction.metadata || transaction.metaData || {};
  };

  // Filter and deduplicate wallet transactions
  const uniqueWalletTransactions = useMemo(() => {
    const seen = new Map();
    return transactions
      .filter(t => 
        t.user_id === user?.id && 
        (!t.contribution_id || t.type === "deposit" || t.type === "withdrawal")
      )
      .filter(transaction => {
        const meta = getMetadata(transaction);
        // Create a unique key based on multiple identifiers
        const key = meta?.paymentReference || 
                   meta?.paymentDetails?.transactionId ||
                   meta?.transactionReference ||
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
      })
      .slice(0, 5); // Keep only the 5 most recent transactions
  }, [transactions, user?.id]);
  
  const handleRefreshBalance = async () => {
    setIsLoading(true);
    try {
      await refreshBalance();
      await fetchTransactions();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeposit = async (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    // Only allow card payments - no manual deposits
    if (depositMethod !== "card") {
      toast.error("Invalid deposit method");
      return;
    }
    
    setIsProcessingDeposit(true);
    
    try {
      // Create an invoice for card payment
      const result = await createPaymentInvoice({
        amount: Number(amount),
        description: "Wallet top-up via card",
        customerEmail: user.email,
        customerName: user.name || `${user.firstName} ${user.lastName}`,
        userId: user.id
      });
      
      if (result && result.checkoutUrl) {
        // Open the checkout URL in a new tab
        window.open(result.checkoutUrl, "_blank");
        toast.success("Payment page opened. Complete your payment to fund your wallet.");
      } else {
        toast.error("Failed to create payment invoice");
      }
    } catch (error) {
      console.error("Error processing deposit:", error);
      toast.error("Failed to process deposit. Please try again.");
    } finally {
      setIsProcessingDeposit(false);
      setAmount("");
      setIsDepositOpen(false);
    }
  };
  
  const handleWithdraw = (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(amount) > (user?.wallet_balance || 0)) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    // TODO: Implement with Supabase wallet balance update
    // updateUserBalance(user.id, user.wallet_balance - Number(amount));
    refreshData();
    setAmount("");
    setIsWithdrawOpen(false);
    toast.success(`Successfully withdrew ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  const toggleBalance = () => {
    setShowBalance(!showBalance);
  };

  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };

  // Format the balance based on selected currency
  const getFormattedBalance = () => {
    const balance = user?.wallet_balance || 0;
    if (currencyType === "NGN") {
      return `₦${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } else {
      const usdBalance = convertToUSD(balance);
      return `$${usdBalance.toFixed(2)}`;
    }
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
      return transaction.senderName || meta?.senderName || "Bank Transfer";
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
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
      <div className="wallet-gradient p-6 text-white relative overflow-hidden bg-[#2DAE75]">
        {/* Large circle decorations */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        
        {/* Currency toggle - Simple clickable button */}
        <button 
          type="button"
          onClick={toggleCurrency}
          className="absolute top-5 right-5 z-20 flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full px-4 py-2 transition-all cursor-pointer select-none"
        >
          <span className={`text-xs font-semibold transition-colors ${currencyType === 'NGN' ? 'text-white' : 'text-white/50'}`}>
            NGN
          </span>
          <div className="w-8 h-4 bg-white/30 rounded-full relative flex items-center">
            <div 
              className={`absolute w-3 h-3 bg-white rounded-full transition-all duration-200 ${
                currencyType === 'USD' ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </div>
          <span className={`text-xs font-semibold transition-colors ${currencyType === 'USD' ? 'text-white' : 'text-white/50'}`}>
            USD
          </span>
        </button>
        
        <div className="relative z-10 mx-0 my-[5px]">
          <div className="flex justify-between items-center mb-1 my-[6px]">
            <p className="text-sm font-medium text-white/80 mb-0 py-[2px]">Available Balance</p>
          </div>
          
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-0">
              {showBalance ? getFormattedBalance() : `${currencyType === "NGN" ? "₦" : "$"}•••••••`}
            </h2>
            <Button variant="ghost" size="icon" onClick={toggleBalance} className="h-8 w-8 text-white hover:bg-white/10 rounded-full">
              {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
        </div>
      </div>
      
      <CardContent className="p-0">
        {!showHistory ? (
          <WalletActions 
            setIsDepositOpen={setIsDepositOpen}
            isDepositOpen={isDepositOpen}
            setIsWithdrawOpen={setIsWithdrawOpen}
            isWithdrawOpen={isWithdrawOpen}
            amount={amount}
            setAmount={setAmount}
            handleDeposit={handleDeposit}
            handleWithdraw={handleWithdraw}
            depositMethod={depositMethod}
            setDepositMethod={setDepositMethod}
            isProcessingDeposit={isProcessingDeposit}
            currencyType={currencyType}
            user={user}
            setShowHistory={setShowHistory}
          />
        ) : (
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Transactions</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-[#2DAE75]">
                Back
              </Button>
            </div>
            
            {uniqueWalletTransactions.length > 0 ? (
              <div className="space-y-3">
                {uniqueWalletTransactions.map(transaction => (
                  <div 
                    key={`${transaction.id}-${transaction.metaData?.paymentReference || ''}`}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => viewTransactionDetails(transaction)}
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {transaction.type === 'deposit' ? <ArrowDown size={18} /> : <ArrowDown size={18} className="transform rotate-180" />}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-sm">
                          {transaction.type === 'deposit' ? 'Money In' : 'Money Out'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const meta = getMetadata(transaction);
                            return meta?.senderName || getSenderBank(transaction) ? 
                              `From: ${meta?.senderName || ""} ${getSenderBank(transaction) ? `(${getSenderBank(transaction)})` : ""}` : 
                              formatDate(transaction.created_at);
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                        {transaction.type === 'deposit' ? '+' : '-'}
                        {currencyType === "NGN" ? `₦${transaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `$${convertToUSD(transaction.amount).toFixed(2)}`}
                      </div>
                      <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No transaction history yet</p>
              </div>
            )}
            
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/wallet-history")}>
              View All Transactions
            </Button>
          </div>
        )}
      </CardContent>
      
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
                  ${selectedTransaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 'bg-amber-100 text-amber-600'}`}>
                  {selectedTransaction.type === 'deposit' ? <ArrowDown size={24} /> : <ArrowDown size={24} className="transform rotate-180" />}
                </div>
              </div>
              
              <div className="text-center mb-4">
                <h3 className={`text-2xl font-bold ${selectedTransaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                  {selectedTransaction.type === 'deposit' ? '+' : '-'}
                  ₦{selectedTransaction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formatDateTime(selectedTransaction.created_at)}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{selectedTransaction.status}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{selectedTransaction.type}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-medium">{selectedTransaction.id.slice(0, 8)}</span>
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
                    
                    {meta?.transactionReference && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="font-medium">{meta.transactionReference}</span>
                      </div>
                    )}
                  </>
                )})()}
                
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
    </Card>
  );
};

export default WalletCard;
