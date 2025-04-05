import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlusCircle, ArrowDown, Bell, Wallet, SendHorizontal, UserPlus, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const WalletCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const {
    user,
    refreshData,
    isAdmin
  } = useApp();
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
  return <Card className="overflow-hidden rounded-3xl border-0 shadow-lg relative">
      <div className="bg-[#EB611A] p-6 text-white relative overflow-hidden">
        {/* Circle pattern decorations */}
        <div className="absolute top-6 right-8 w-20 h-20 rounded-full border-2 border-white/10 opacity-20"></div>
        <div className="absolute top-12 right-12 w-12 h-12 rounded-full border-2 border-white/10 opacity-20"></div>
        <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full border-2 border-white/10 opacity-10"></div>
        <div className="absolute bottom-16 left-4 w-8 h-8 rounded-full border-2 border-white/10 opacity-10"></div>
        
        {/* Stripe pattern decorations */}
        <div className="absolute top-0 right-0 w-full h-full">
          <div className="absolute top-4 right-6 w-40 h-[1px] bg-white/10"></div>
          <div className="absolute top-8 right-6 w-32 h-[1px] bg-white/10"></div>
          <div className="absolute bottom-12 left-6 w-40 h-[1px] bg-white/10"></div>
          <div className="absolute bottom-8 left-6 w-32 h-[1px] bg-white/10"></div>
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <Avatar className="h-12 w-12 border-2 border-white/30">
            <AvatarImage src={user.profileImage || ""} alt={user.name} />
            <AvatarFallback className="bg-white text-[#EB611A]">
              {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
            </AvatarFallback>
          </Avatar>
          
          <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full">
            <Bell size={20} />
          </Button>
        </div>

        <div className="mb-6 relative z-10">
          <p className="text-sm text-white/80 mb-1">Available Balance</p>
          <div className="flex items-baseline">
            <h2 className="text-4xl font-bold tracking-tight">
              {showBalance ? `₦${user.walletBalance?.toLocaleString() || 0}` : "₦•••••••"}
            </h2>
          </div>
        </div>
      </div>
      
      <CardContent className="p-0">
        <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
          <div className="grid grid-cols-4 gap-1 pt-2 px-4">
            <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#EB611A]/10 flex items-center justify-center text-[#EB611A] mb-1">
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
                  <div className="w-10 h-10 rounded-full bg-[#EB611A]/10 flex items-center justify-center text-[#EB611A] mb-1">
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
                <div className="w-10 h-10 rounded-full bg-[#EB611A]/10 flex items-center justify-center text-[#EB611A] mb-1">
                  <UserPlus size={20} />
                </div>
                <span className="text-xs">Group</span>
              </Link>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#EB611A]/10 flex items-center justify-center text-[#EB611A] mb-1">
                <Clock size={20} />
              </div>
              <span className="text-xs">History</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
};
export default WalletCard;