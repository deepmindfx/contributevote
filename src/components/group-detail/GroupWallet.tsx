
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DialogTrigger } from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Wallet } from "lucide-react";
import { Contribution } from "@/services/localStorage";
import { format, isValid } from "date-fns";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import ContributeDialog from "./dialogs/ContributeDialog";
import WithdrawalRequestDialog from "./dialogs/WithdrawalRequestDialog";

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
  const [contributeDialogOpen, setContributeDialogOpen] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  
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
          <Button 
            className="flex-1 bg-[#2dae75]"
            onClick={() => setContributeDialogOpen(true)}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            Contribute
          </Button>
          
          {isUserCreator && (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setWithdrawalDialogOpen(true)}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Request Withdrawal
            </Button>
          )}
        </div>
      </div>
      
      {/* Contribute Dialog */}
      <ContributeDialog
        open={contributeDialogOpen}
        onOpenChange={setContributeDialogOpen}
        contributionAmount={contributionAmount}
        setContributionAmount={setContributionAmount}
        anonymous={anonymous}
        setAnonymous={setAnonymous}
        onContribute={() => {
          handleContribute();
          setContributeDialogOpen(false);
        }}
      />
      
      {/* Withdrawal Request Dialog */}
      {isUserCreator && (
        <WithdrawalRequestDialog
          open={withdrawalDialogOpen}
          onOpenChange={setWithdrawalDialogOpen}
          withdrawalAmount={withdrawalAmount}
          setWithdrawalAmount={setWithdrawalAmount}
          withdrawalPurpose={withdrawalPurpose}
          setWithdrawalPurpose={setWithdrawalPurpose}
          onRequestWithdrawal={() => {
            handleRequestWithdrawal();
            setWithdrawalDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default GroupWallet;
