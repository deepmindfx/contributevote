
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ContributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributionAmount: string;
  setContributionAmount: React.Dispatch<React.SetStateAction<string>>;
  anonymous: boolean;
  setAnonymous: React.Dispatch<React.SetStateAction<boolean>>;
  onContribute: () => void;
}

const ContributeDialog = ({
  open,
  onOpenChange,
  contributionAmount,
  setContributionAmount,
  anonymous,
  setAnonymous,
  onContribute
}: ContributeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a Contribution</DialogTitle>
          <DialogDescription>
            Enter the amount you want to contribute to this group.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contribution-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
              <Input 
                id="contribution-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={contributionAmount} 
                onChange={e => setContributionAmount(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="anonymous" 
              checked={anonymous} 
              onCheckedChange={checked => setAnonymous(checked as boolean)} 
            />
            <label htmlFor="anonymous" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Contribute anonymously
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setContributionAmount("")}>Cancel</Button>
          <Button onClick={onContribute} className="bg-green-600 hover:bg-green-700">Contribute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContributeDialog;
