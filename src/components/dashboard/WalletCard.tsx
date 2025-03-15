
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ArrowDown, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";

const WalletCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  
  const { user, refreshData } = useApp();

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
    <Card className="glass-card overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-medium text-sm text-muted-foreground">Total Balance</h3>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refreshBalance}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline">
            <h2 className="text-3xl font-bold tracking-tight">
              {showBalance ? `₦ ${user.walletBalance?.toLocaleString() || 0}` : "₦ •••••••"}
            </h2>
            <span className="ml-2 text-sm text-green-500 font-medium">+5.2%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Available Balance</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary/10 hover:bg-primary/20 text-primary">
                <PlusCircle className="mr-2 h-4 w-4" />
                <span>Deposit</span>
              </Button>
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
              <Button variant="outline">
                <ArrowDown className="mr-2 h-4 w-4" />
                <span>Withdraw</span>
              </Button>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
