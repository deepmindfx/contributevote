
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, CreditCard } from "lucide-react";
import { payWithMonnify } from "@/utils/monnifyPayment";
import { useUser } from "@/contexts/UserContext";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import MonnifyAmountDialog from "../dialogs/MonnifyAmountDialog";

interface WalletActionsProps {
  isUserCreator: boolean;
  onContributeClick: () => void;
  onWithdrawClick: () => void;
  contributionId: string;
  contributionName: string;
  contributionAccountReference?: string;
}

const WalletActions = ({ 
  isUserCreator, 
  onContributeClick, 
  onWithdrawClick,
  contributionId,
  contributionName,
  contributionAccountReference
}: WalletActionsProps) => {
  const { user } = useUser();
  const { refreshData } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMonnifyDialogOpen, setIsMonnifyDialogOpen] = useState(false);

  const handleMonnifyPayment = (amount: number, anonymous: boolean) => {
    if (!user || !user.id) {
      toast.error("Please log in to contribute");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      payWithMonnify({
        amount: amount,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        contribution: {
          id: contributionId,
          name: contributionName,
          accountReference: contributionAccountReference
        },
        anonymous: anonymous,
        onSuccess: (response) => {
          console.log("Payment success, refreshing data", response);
          refreshData();
          setIsProcessing(false);
          setIsMonnifyDialogOpen(false);
          toast.success("Payment initiated successfully. Check back for confirmation.");
        },
        onClose: () => {
          console.log("Payment window closed");
          setIsProcessing(false);
          setIsMonnifyDialogOpen(false);
        }
      });
    } catch (error) {
      console.error("Monnify payment error:", error);
      toast.error("Payment initialization failed. Please try again.");
      setIsProcessing(false);
      setIsMonnifyDialogOpen(false);
    }
  };

  return (
    <>
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
          onClick={() => setIsMonnifyDialogOpen(true)}
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
            Withdrawal
          </Button>
        )}
      </div>
      
      {/* Custom Monnify Amount Dialog */}
      <MonnifyAmountDialog
        open={isMonnifyDialogOpen}
        onOpenChange={setIsMonnifyDialogOpen}
        onProceed={handleMonnifyPayment}
        isProcessing={isProcessing}
        contributionName={contributionName}
      />
    </>
  );
};

export default WalletActions;
