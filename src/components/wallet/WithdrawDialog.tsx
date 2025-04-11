
import React from "react";
import { 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface WithdrawDialogProps {
  currencyType: "NGN" | "USD";
  amount: string;
  setAmount: (amount: string) => void;
  onWithdraw: () => void;
  onClose: () => void;
}

const WithdrawDialog = ({ 
  currencyType, 
  amount, 
  setAmount, 
  onWithdraw, 
  onClose 
}: WithdrawDialogProps) => {
  return (
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
            <Input 
              id="withdraw-amount" 
              type="number" 
              className="pl-8" 
              placeholder="0.00" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onWithdraw}>Withdraw</Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default WithdrawDialog;
