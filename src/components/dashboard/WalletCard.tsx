
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  PlusCircle, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldCheck,
  Wallet,
  SendHorizontal,
  TimerReset,
  Clock,
  History
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WalletCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  
  const { user, refreshData, isAdmin } = useApp();

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

  return (
    <Card className="overflow-hidden rounded-xl border-0">
      <div className="bg-[#4a0082] p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/30">
              <AvatarImage src={user.profileImage || ""} alt={user.name} />
              <AvatarFallback className="bg-primary-foreground text-primary">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/10"
                  asChild
                >
                  <Link to="/admin">
                    <ShieldCheck size={16} />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={refreshBalance}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-sm text-white/80 mb-1">Available Balance</p>
          <div className="flex items-baseline">
            <h2 className="text-4xl font-bold tracking-tight">
              {showBalance ? `$${user.walletBalance?.toLocaleString() || 0}` : "$•••••••"}
            </h2>
          </div>
        </div>
      </div>
      
      <CardContent className="p-0">
        <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
          <div className="p-3 grid grid-cols-4 gap-1 border-b">
            <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-1">
                    <PlusCircle size={18} />
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
                      <Input
                        id="deposit-amount"
                        type="number"
                        className="pl-8"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
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
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
                    <SendHorizontal size={18} />
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
                      <Input
                        id="withdraw-amount"
                        type="number"
                        className="pl-8"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
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
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-1">
                <ArrowDown size={18} />
              </div>
              <span className="text-xs">Request</span>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-1">
                <History size={18} />
              </div>
              <span className="text-xs">History</span>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Payment List</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              <Button variant="outline" className="flex flex-col items-center justify-center h-auto py-3 px-2" asChild>
                <Link to="/create-group">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-100 text-red-500 mb-1">
                    <Wallet size={18} />
                  </div>
                  <span className="text-xs">New Group</span>
                </Link>
              </Button>
              
              <div className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-lg">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-100 text-yellow-500 mb-1">
                  <RefreshCw size={18} />
                </div>
                <span className="text-xs">Electricity</span>
              </div>
              
              <div className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-lg">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-green-500 mb-1">
                  <PlusCircle size={18} />
                </div>
                <span className="text-xs">Voucher</span>
              </div>
              
              <div className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-lg">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 text-blue-500 mb-1">
                  <ShieldCheck size={18} />
                </div>
                <span className="text-xs">Assurance</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
