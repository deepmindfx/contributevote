import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaChart } from "@/components/ui/chart";
import { useApp } from "@/contexts/AppContext";
import { Plus, PiggyBank, CreditCard, Wallet, Coins, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addTransaction } from "@/services/localStorage";

const chartData = [
  { name: "Jan", Contribution: 4000 },
  { name: "Feb", Contribution: 3000 },
  { name: "Mar", Contribution: 2000 },
  { name: "Apr", Contribution: 2780 },
  { name: "May", Contribution: 1890 },
  { name: "Jun", Contribution: 2390 },
  { name: "Jul", Contribution: 3490 },
  { name: "Aug", Contribution: 4000 },
  { name: "Sep", Contribution: 3000 },
  { name: "Oct", Contribution: 2000 },
  { name: "Nov", Contribution: 2780 },
  { name: "Dec", Contribution: 1890 },
];

const WalletCard = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);

  const handleDeposit = () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }

    // Simulate deposit logic here
    const amount = Number(depositAmount);
    // In a real application, you would call an API to deposit funds
    // and update the user's wallet balance in the backend.
    // For this example, we'll just show a success message.
    toast.success(`Successfully deposited ₦${amount.toLocaleString()} to your wallet.`);
    setDepositAmount("");
    setIsDepositOpen(false);
  };

  const handleWithdrawal = () => {
    if (!withdrawalAmount || isNaN(Number(withdrawalAmount)) || Number(withdrawalAmount) <= 0) {
      toast.error("Please enter a valid withdrawal amount.");
      return;
    }

    if (Number(withdrawalAmount) > user.walletBalance) {
      toast.error("Insufficient funds in your wallet.");
      return;
    }

    // Simulate withdrawal logic here
    const amount = Number(withdrawalAmount);
    // In a real application, you would call an API to withdraw funds
    // and update the user's wallet balance in the backend.
    // For this example, we'll just show a success message.
    toast.success(`Successfully requested a withdrawal of ₦${amount.toLocaleString()} from your wallet.`);
    setWithdrawalAmount("");
    setIsWithdrawalOpen(false);
  };

  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-semibold">Wallet</CardTitle>
        <CardDescription>Your CollectiPay balance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">₦{user?.walletBalance?.toLocaleString() || "0"}</div>
        <AreaChart data={chartData} valueKey="Contribution" nameKey="name" aspect={300 / 150} />
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <Button className="bg-[#2DAE75] hover:bg-[#249e69]" onClick={() => setIsDepositOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Deposit Funds
        </Button>

        <Button variant="outline" onClick={() => setIsWithdrawalOpen(true)}>
          <ArrowDown className="h-4 w-4 mr-2" />
          Withdraw Funds
        </Button>
      </CardFooter>

      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Deposit Funds</DialogTitle>
            <DialogDescription>Enter the amount you want to deposit into your wallet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="depositAmount" className="text-right">
                Amount
              </Label>
              <Input
                type="number"
                id="depositAmount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleDeposit}>
              Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawalOpen} onOpenChange={setIsWithdrawalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>Enter the amount you want to withdraw from your wallet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="withdrawalAmount" className="text-right">
                Amount
              </Label>
              <Input
                type="number"
                id="withdrawalAmount"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleWithdrawal}>
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WalletCard;
