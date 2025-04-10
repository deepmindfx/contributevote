
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ArrowDown, SendHorizontal, UserPlus, Clock, Eye, EyeOff, DollarSign, Building, RefreshCw } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

const WalletCard = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [virtualAccountTransactions, setVirtualAccountTransactions] = useState<any[]>([]);
  const {
    user,
    refreshData,
    isAdmin,
    transactions,
    getVirtualAccountTransactions
  } = useApp();

  useEffect(() => {
    if (user?.virtualAccount) {
      fetchVirtualAccountTransactions();
    }
  }, [user?.virtualAccount]);

  const fetchVirtualAccountTransactions = async () => {
    try {
      setIsLoading(true);
      if (getVirtualAccountTransactions) {
        const transactions = await getVirtualAccountTransactions();
        setVirtualAccountTransactions(transactions || []);
        
        // When transactions come in from Monnify, update the local wallet balance
        if (transactions && transactions.length > 0) {
          // Calculate total deposits from Monnify
          const totalDeposits = transactions
            .filter(t => t.paymentStatus === 'PAID')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
          
          if (totalDeposits > 0) {
            // Refresh data to update the wallet balance in context
            refreshData();
          }
        }
      }
    } catch (error) {
      console.error("Error fetching virtual account transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle currency function
  const toggleCurrency = () => {
    setCurrencyType(prev => prev === "NGN" ? "USD" : "NGN");
  };

  // Filter only the user's wallet-related transactions 
  // Now merging local transactions with Monnify API transactions
  const walletTransactions = (user ? [...(transactions || []).filter(t => 
    t.userId === user.id && (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal")
  ).map(t => ({
    ...t,
    source: 'local'
  })), 
  ...virtualAccountTransactions.map(t => ({
    id: t.id,
    userId: user.id,
    contributionId: '',
    type: t.paymentStatus === 'PAID' ? 'deposit' : 'withdrawal',
    amount: t.amount,
    description: `Via ${t.paymentMethod || 'Monnify'} (${t.paymentReference})`,
    createdAt: t.createdOn || t.paidOn,
    status: t.paymentStatus === 'PAID' ? 'completed' : 'pending',
    source: 'monnify'
  }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5) : []);
  
  const refreshBalance = () => {
    setIsLoading(true);
    fetchVirtualAccountTransactions();
    setTimeout(() => {
      refreshData();
      setIsLoading(false);
    }, 1000);
  };
  
  const handleDeposit = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    // For deposits, we'll redirect to the virtual account page
    // since deposits should come through the virtual account
    setAmount("");
    setIsDepositOpen(false);
    navigate('/virtual-account');
    toast.info("Please use your virtual account for deposits");
  };
  
  const handleWithdraw = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!user || Number(amount) > user.walletBalance) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    
    // For withdrawals, we'll use the Monnify API (through the context)
    setIsWithdrawOpen(false);
    
    // In a real implementation, we would collect banking details
    // For now we'll just show a toast explaining limitations
    toast.info("To withdraw funds, please visit the account page to enter your banking details");
    navigate('/virtual-account');
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
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
    if (!user) return currencyType === "NGN" ? "₦0" : "$0.00";
    
    const balance = user.walletBalance || 0;
    if (currencyType === "NGN") {
      return `₦${balance.toLocaleString()}`;
    } else {
      const usdBalance = convertToUSD(balance);
      return `$${usdBalance.toFixed(2)}`;
    }
  };

  if (!user) {
    return (
      <Card className="overflow-hidden rounded-3xl border-0">
        <div className="p-6 text-white relative overflow-hidden bg-[#2DAE75]">
          <div className="relative z-10 mx-0 my-[5px]">
            <div className="flex justify-between items-center mb-1 my-[6px]">
              <p className="text-base font-medium text-white/80 mb-0 py-[2px]">Available Balance</p>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">₦0</h2>
          </div>
        </div>
        <CardContent className="p-4 text-center">
          <p>Loading wallet information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-0">
      <div className="p-6 text-white relative overflow-hidden bg-[#2DAE75]">
        {/* Currency toggle - Fixed positioning and default state */}
        <div className="absolute top-5 right-5 flex items-center bg-green-600/50 rounded-full px-3 py-1.5">
          <span className={`text-xs ${currencyType === 'NGN' ? 'text-white' : 'text-white/60'}`}>NGN</span>
          <button 
            onClick={toggleCurrency} 
            className="mx-1.5 w-8 h-4 bg-green-500 rounded-full relative"
          >
            <span 
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                currencyType === 'USD' ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={`text-xs ${currencyType === 'USD' ? 'text-white' : 'text-white/60'}`}>USD</span>
        </div>
        
        <div className="relative z-10 mx-0 my-[5px]">
          <div className="flex justify-between items-center mb-1 my-[6px]">
            <p className="text-base font-medium text-white/80 mb-0 py-[2px]">Available Balance</p>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={refreshBalance} 
              className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
              disabled={isLoading}
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </Button>
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
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
            <div className="grid grid-cols-4 gap-1 pt-2 px-4">
              <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
                <DialogTrigger asChild>
                  <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                      <PlusCircle size={20} />
                    </div>
                    <span className="text-xs">Top Up</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                    <DialogDescription>
                      Add money to your wallet using your virtual account. You can view your account details on the Account page.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    <Button className="w-full" onClick={() => {
                      setIsDepositOpen(false);
                      navigate('/virtual-account');
                    }}>
                      View Account Details
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                <DialogTrigger asChild>
                  <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                      <SendHorizontal size={20} />
                    </div>
                    <span className="text-xs">Send</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                    <DialogDescription>
                      Withdraw money from your wallet. Enter the amount you want to withdraw.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount ({currencyType})</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">
                          {currencyType === "NGN" ? "₦" : "$"}
                        </span>
                        <Input id="withdraw-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
                    <Button onClick={handleWithdraw}>Withdraw</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                <Link to="/virtual-account" className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                    <Building size={20} />
                  </div>
                  <span className="text-xs">Account</span>
                </Link>
              </div>
              
              <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors" onClick={() => setShowHistory(true)}>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                  <Clock size={20} />
                </div>
                <span className="text-xs">History</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Transactions</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-[#2DAE75]">
                Back
              </Button>
            </div>
            
            {walletTransactions.length > 0 ? (
              <div className="space-y-3">
                {walletTransactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                      {transaction.type === 'deposit' ? '+' : '-'}
                      {currencyType === "NGN" ? `₦${transaction.amount.toLocaleString()}` : `$${convertToUSD(transaction.amount).toFixed(2)}`}
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
    </Card>
  );
};

export default WalletCard;
