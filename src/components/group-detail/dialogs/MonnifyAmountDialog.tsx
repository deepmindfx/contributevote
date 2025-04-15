
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface MonnifyAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: (amount: number, anonymous: boolean) => void;
  isProcessing: boolean;
  contributionName: string;
}

const MonnifyAmountDialog = ({
  open,
  onOpenChange,
  onProceed,
  isProcessing,
  contributionName
}: MonnifyAmountDialogProps) => {
  const [amount, setAmount] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const handleProceed = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return;
    }
    onProceed(Number(amount), anonymous);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with Card/Bank</DialogTitle>
          <DialogDescription>
            Enter the amount you want to contribute to "{contributionName}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="monnify-amount">Amount (NGN)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
              <Input 
                id="monnify-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="anonymous-monnify" 
              checked={anonymous} 
              onCheckedChange={checked => setAnonymous(checked as boolean)} 
            />
            <label 
              htmlFor="anonymous-monnify" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Contribute anonymously
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProceed} 
            className="bg-green-600 hover:bg-green-700"
            disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0 || isProcessing}
          >
            {isProcessing ? "Processing..." : "Proceed to Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MonnifyAmountDialog;
