import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ArrowDown, Wallet, SendHorizontal, UserPlus, Clock, Eye, EyeOff, DollarSign, CreditCard, Building, ExternalLink } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { WalletService } from "@/services/supabase/walletService";
import WalletActions from "@/components/dashboard/wallet/WalletActions";
import { CurrencySelector } from "@/components/wallet/CurrencySelector";
import { useBalanceUpdates } from "@/hooks/useBalanceUpdates";

const WalletCard = ({ onOpenBankAccount, isDepositOpen, setIsDepositOpen }: {
  onOpenBankAccount: () => void;
  isDepositOpen: boolean;
  setIsDepositOpen: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
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
        t.type !== "vote"
      )
      .filter(transaction => {
        const meta = getMetadata(transaction);
        const key = meta?.paymentReference || 
                   meta?.paymentDetails?.transactionId ||
                   meta?.transactionReference ||
                   transaction.reference_id ||
                   transaction.id;

        if (seen.has(key)) {
          return false;
        }
        seen.set(key, true);
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
      })
      .slice(0, 5);
  }, [transactions, user?.id]);
  
  const handleRefreshBalance = async () => {
    setIsLoading(true);
    try {
      await refreshBalance();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeposit = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsProcessingDeposit(true);
    try {
      const result = await WalletService.createPaymentInvoice({
        amount: Number(amount),
        description: "Wallet top-up via card",
        customerEmail: user.email || "",
        customerName: user.name || user.email || "User",
        userId: user.id
      });
      
      if (result && result.checkoutUrl) {
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
    e.preventDefault();
    e.stopPropagation();
    setIsWithdrawOpen(false);
    navigate("/transfer");
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
    <Card className="dashboard-wallet-card overflow-hidden rounded-[1.35rem]">
      <div className="wallet-overview px-5 pb-7 pt-4 sm:px-7 sm:pb-9 sm:pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 items-center gap-0.5">
            <p className="text-sm font-medium text-white/90">Available balance</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBalance}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
              className="h-11 w-11 shrink-0 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              {showBalance ? <EyeOff size={17} /> : <Eye size={17} />}
            </Button>
          </div>
          <CurrencySelector value={currencyType} onChange={setCurrencyType} onDark />
        </div>
        <div className="min-w-0">
          <p className="break-words text-[clamp(1.875rem,7.6vw,3.3rem)] font-semibold leading-tight tracking-[-.06em] tabular-nums">
            {showBalance ? getFormattedBalance() : `${currencyType === "NGN" ? "₦" : "$"}•••••••`}
          </p>
          {currencyType === "USD" && showBalance && <p className="mt-1 text-sm text-white/80">Approximate USD equivalent</p>}
        </div>
      </div>
      <CardContent className="dashboard-wallet-content p-0">
        {!showHistory || isDepositOpen ? (
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
            onOpenBankAccount={onOpenBankAccount}
            showQuickActions
          />
        ) : (
          <div className="bg-card p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Transactions</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-[#2DAE75]">
                Back
              </Button>
            </div>
            
            {uniqueWalletTransactions.length > 0 ? (
              <div className="space-y-3">
                {uniqueWalletTransactions.map(transaction => {
                  const isCredit = transaction.type === 'deposit' || transaction.type === 'refund';
                  const meta = getMetadata(transaction);
                  return (
                  <div 
                    key={`${transaction.id}-${meta?.paymentReference || ''}`}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => viewTransactionDetails(transaction)}
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${isCredit ? 'bg-green-100 text-[#2DAE75]' : 'bg-amber-100 text-amber-600'}`}>
                        {isCredit ? <ArrowDown size={18} /> : <ArrowDown size={18} className="transform rotate-180" />}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-sm">
                          {transaction.type === 'deposit' ? 'Money In' :
                           transaction.type === 'refund' ? 'Refund Received' :
                           transaction.type === 'contribution' ? 'Group Contribution' :
                           transaction.type === 'transfer' ? 'Bank Transfer' :
                           'Money Out'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meta?.senderName || getSenderBank(transaction) ? 
                            `From: ${meta?.senderName || ""} ${getSenderBank(transaction) ? `(${getSenderBank(transaction)})` : ""}` : 
                            formatDate(transaction.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`font-semibold ${isCredit ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                        {isCredit ? '+' : '-'}
                        {currencyType === "NGN" ? `₦${Number(transaction.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `$${convertToUSD(Number(transaction.amount)).toFixed(2)}`}
                      </div>
                      <ExternalLink className="ml-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );})}
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
