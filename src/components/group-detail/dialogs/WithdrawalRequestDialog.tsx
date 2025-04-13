
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WithdrawalRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawalAmount: string;
  setWithdrawalAmount: React.Dispatch<React.SetStateAction<string>>;
  withdrawalPurpose: string;
  setWithdrawalPurpose: React.Dispatch<React.SetStateAction<string>>;
  onRequestWithdrawal: () => void;
}

const WithdrawalRequestDialog = ({
  open,
  onOpenChange,
  withdrawalAmount,
  setWithdrawalAmount,
  withdrawalPurpose,
  setWithdrawalPurpose,
  onRequestWithdrawal
}: WithdrawalRequestDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Fund Withdrawal</DialogTitle>
          <DialogDescription>
            Submit a request to withdraw funds. All contributors will vote on this request within 24 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="withdrawal-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
              <Input 
                id="withdrawal-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={withdrawalAmount} 
                onChange={e => setWithdrawalAmount(e.target.value)} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawal-purpose">Purpose</Label>
            <Textarea 
              id="withdrawal-purpose" 
              placeholder="Explain why you're requesting these funds" 
              rows={3} 
              value={withdrawalPurpose} 
              onChange={e => setWithdrawalPurpose(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setWithdrawalAmount("");
              setWithdrawalPurpose("");
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={onRequestWithdrawal} 
            className="bg-green-600 hover:bg-green-700"
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalRequestDialog;
