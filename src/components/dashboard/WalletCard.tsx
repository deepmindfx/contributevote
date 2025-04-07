
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ArrowDown, Bell, Wallet, SendHorizontal, UserPlus, Clock, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { format } from "date-fns";
import { Toggle } from "@/components/ui/toggle";

const WalletCard = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const {
    user,
    refreshData,
    isAdmin,
    transactions
  } = useApp();

  // Filter only the user's wallet-related transactions
  const walletTransactions = transactions.filter(t => t.userId === user.id && (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal")).slice(0, 5);
  
  const refreshBalance = () => {
    setIsLoading(true);
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
    updateUserBalance(Number(amount));
    refreshData();
    setAmount("");
    setIsDepositOpen(false);
    toast.success(`Successfully deposited ₦${Number(amount).toLocaleString()}`);
  };
  
  const handleWithdraw = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(amount) > user.walletBalance) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    updateUserBalance(-Number(amount));
    refreshData();
    setAmount("");
    setIsWithdrawOpen(false);
    toast.success(`Successfully withdrew ₦${Number(amount).toLocaleString()}`);
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  const toggleBalance = () => {
    setShowBalance(!showBalance);
  };
  
  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-lg relative">
      <div className="wallet-gradient p-6 text-white relative overflow-hidden bg-[#2DAE75]">
        {/* Large circle decorations */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        
        <div className="mb-6 relative z-10">
          <p className="text-sm text-white/80 mb-1 px-0 py-[10px]">Available Balance</p>
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-bold tracking-tight">
              {showBalance ? `₦${user.walletBalance?.toLocaleString() || 0}` : "₦•••••••"}
            </h2>
            <Button variant="ghost" size="icon" onClick={toggleBalance} className="h-10 w-10 text-white hover:bg-white/10 rounded-full">
              {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
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
                      Add money to your wallet. Enter the amount you want to deposit.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                        <Input id="deposit-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeposit}>Deposit</Button>
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
                      <Label htmlFor="withdraw-amount">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
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
                <Link to="/create-group" className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                    <UserPlus size={20} />
                  </div>
                  <span className="text-xs">Group</span>
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
                      {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
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
