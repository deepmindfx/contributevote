
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, CreditCard } from "lucide-react";
import { payWithMonnify } from "@/utils/monnifyPayment";
import { useUser } from "@/contexts/UserContext";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

interface WalletActionsProps {
  isUserCreator: boolean;
  onContributeClick: () => void;
  onWithdrawClick: () => void;
  contributionId: string;
  contributionName: string;
}

const WalletActions = ({ 
  isUserCreator, 
  onContributeClick, 
  onWithdrawClick,
  contributionId,
  contributionName
}: WalletActionsProps) => {
  const { user } = useUser();
  const { refreshContributionData } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMonnifyPayment = async () => {
    if (!user || !user.id) {
      toast.error("Please log in to contribute");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      await payWithMonnify({
        amount: 0, // Will be set in the dialog
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        contribution: {
          id: contributionId,
          name: contributionName
        },
        onSuccess: (response) => {
          toast.success("Payment successful!");
          refreshContributionData();
        },
        onClose: () => {
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error("Monnify payment error:", error);
      toast.error("Payment initialization failed. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <Button 
        className="flex-1 bg-[#2dae75]"
        onClick={onContributeClick}
      >
        <ArrowDown className="mr-2 h-4 w-4" />
        Contribute from Wallet
      </Button>
      
      <Button 
        className="flex-1"
        variant="outline"
        onClick={handleMonnifyPayment}
        disabled={isProcessing}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        {isProcessing ? "Processing..." : "Pay with Card/Bank"}
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
