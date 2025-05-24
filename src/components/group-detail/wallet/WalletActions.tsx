
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, CreditCard } from "lucide-react";
import { payWithFlutterwave } from "@/utils/flutterwavePayment";
import { useUser } from "@/contexts/UserContext";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import PaymentAmountDialog from "../dialogs/PaymentAmountDialog";
import { contributeToGroup } from "@/services/localStorage";

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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const handlePayment = async (amount: number, anonymous: boolean) => {
    if (!user) return;
    
    try {
      setIsProcessing(true);
      
      await payWithFlutterwave(
        amount,
        user.email,
        user.name,
        contributionName,
        async (response) => {
          console.log('Processing Flutterwave success response:', response);
          try {
            // Contribute to group with Flutterwave payment details
            await contributeToGroup(contributionId, amount, anonymous, {
              paymentMethod: 'flutterwave',
              paymentReference: response.paymentReference || response.tx_ref,
              paymentProvider: 'flutterwave',
              paymentStatus: response.status,
              paymentDetails: {
                transactionId: response.transactionId,
                flutterwaveReference: response.flutterwaveReference,
                chargeResponseCode: response.chargeResponseCode,
                chargeResponseMessage: response.chargeResponseMessage,
                currency: response.currency,
                chargedAmount: response.charged_amount,
                createdAt: response.created_at
              }
            });
            
            toast.success('Payment successful!');
            // Force a refresh of the data
            setTimeout(() => {
              refreshData();
            }, 500);
          } catch (error) {
            console.error('Error processing successful payment:', error);
            toast.error('Error processing payment. Please contact support.');
          }
        },
        () => {
          setIsProcessing(false);
          setIsPaymentDialogOpen(false);
          toast.error('Payment cancelled');
        }
      );
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setIsPaymentDialogOpen(false);
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
          onClick={() => setIsPaymentDialogOpen(true)}
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
      
      {/* Payment Amount Dialog */}
      <PaymentAmountDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onProceed={handlePayment}
        isProcessing={isProcessing}
        contributionName={contributionName}
      />
    </>
  );
};

export default WalletActions;
