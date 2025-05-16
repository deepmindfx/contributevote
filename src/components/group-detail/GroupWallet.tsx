import React, { useState, useEffect } from "react";
import { Contribution } from "@/services/localStorage";
import { WalletHeader, WalletProgress, WalletDetails, WalletActions } from "./wallet";
import ContributeDialog from "./dialogs/ContributeDialog";
import WithdrawalRequestDialog from "./dialogs/WithdrawalRequestDialog";
import { getReservedAccountTransactions } from "@/services/walletIntegration";

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
  const [checkedTransactions, setCheckedTransactions] = useState(false);
  
  const progressPercentage = Math.min(100, Math.round(contribution.currentAmount / contribution.targetAmount * 100));
  
  // Check for new transactions only once when the component first mounts
  useEffect(() => {
    // Only check once per component lifecycle
    if (!checkedTransactions && contribution && contribution.accountReference) {
      setCheckedTransactions(true);
      console.log("Checking for transactions on mount for:", contribution.accountReference);
      
      // Add a slight delay to avoid immediate API call
      setTimeout(() => {
        getReservedAccountTransactions(contribution.accountReference)
          .catch(err => {
            console.error("Error fetching transactions:", err);
          });
      }, 1000);
    }
  }, [contribution, checkedTransactions]);
  
  return (
    <div className="glass-card mb-6 animate-slide-up border-2 border-green-100 dark:border-green-900">
      <div className="p-6">
        <WalletHeader 
          contribution={contribution} 
          progressPercentage={progressPercentage} 
        />
        
        <WalletProgress progressPercentage={progressPercentage} />
        
        <WalletDetails contribution={contribution} />
        
        <WalletActions 
          isUserCreator={isUserCreator}
          onContributeClick={() => setContributeDialogOpen(true)}
          onWithdrawClick={() => setWithdrawalDialogOpen(true)}
          contributionId={contribution.id}
          contributionName={contribution.name}
          contributionAccountReference={contribution.accountReference}
        />
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
