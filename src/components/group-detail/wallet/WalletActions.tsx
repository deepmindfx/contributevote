
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp } from "lucide-react";

interface WalletActionsProps {
  isUserCreator: boolean;
  onContributeClick: () => void;
  onWithdrawClick: () => void;
}

const WalletActions = ({ 
  isUserCreator, 
  onContributeClick, 
  onWithdrawClick 
}: WalletActionsProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <Button 
        className="flex-1 bg-[#2dae75]"
        onClick={onContributeClick}
      >
        <ArrowDown className="mr-2 h-4 w-4" />
        Contribute
      </Button>
      
      {isUserCreator && (
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onWithdrawClick}
        >
          <ArrowUp className="mr-2 h-4 w-4" />
          Request Withdrawal
        </Button>
      )}
    </div>
  );
};

export default WalletActions;
