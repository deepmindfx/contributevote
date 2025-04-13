
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDown, ArrowUp, Wallet } from "lucide-react";
import { Contribution } from "@/services/localStorage";
import { format, isValid } from "date-fns";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import { toast } from "sonner";

interface GroupWalletProps {
  contribution: Contribution;
  isUserCreator: boolean;
  contributionAmount: string;
  setContributionAmount: React.Dispatch<React.SetStateAction<string>>;
  withdrawalAmount: string;
  setWithdrawalAmount: React.Dispatch<React.SetStateAction<string>>;
  withdrawalPurpose: string;
  setWithdrawalPurpose: React.Dispatch<React.SetStateAction<string>>;
  anonymous: boolean;
  setAnonymous: React.Dispatch<React.SetStateAction<boolean>>;
  handleContribute: () => void;
  handleRequestWithdrawal: () => void;
}

const GroupWallet = ({
  contribution,
  isUserCreator,
  contributionAmount,
  setContributionAmount,
  withdrawalAmount,
  setWithdrawalAmount,
  withdrawalPurpose,
  setWithdrawalPurpose,
  anonymous,
  setAnonymous,
  handleContribute,
  handleRequestWithdrawal
}: GroupWalletProps) => {
  const progressPercentage = Math.min(100, Math.round(contribution.currentAmount / contribution.targetAmount * 100));
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  return (
    <div className="glass-card mb-6 animate-slide-up border-2 border-green-100 dark:border-green-900">
      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Group Wallet</h3>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">CollectiPay</p>
                <Badge variant="outline" className="text-xs">
                  {contribution?.category}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="text-center md:text-right">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              ₦{contribution?.currentAmount.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              of ₦{contribution?.targetAmount.toLocaleString()} goal ({progressPercentage}%)
            </p>
          </div>
        </div>
        
        <div className="mt-4">
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          {/* Account Number Display */}
          {contribution && (
            <AccountNumberDisplay 
              accountNumber={contribution.accountNumber || ''} 
              accountName={contribution.name || ''}
              monnifyDetails={contribution.accountDetails}
            />
          )}
          
          <div className="space-y-2">
            <span className="text-sm font-medium">Group Details</span>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frequency</span>
              <span className="capitalize">{contribution?.frequency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Members</span>
              <span>{contribution?.members.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span>{formatDate(contribution?.startDate)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex-1 bg-[#2dae75]">
                <ArrowDown className="mr-2 h-4 w-4" />
                Contribute
              </Button>
            </DialogTrigger>
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
                <Button onClick={handleContribute} className="bg-green-600 hover:bg-green-700">Contribute</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {isUserCreator && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Request Withdrawal
                </Button>
              </DialogTrigger>
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
                    onClick={handleRequestWithdrawal} 
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupWallet;
