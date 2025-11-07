import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { ContributorService } from '@/services/supabase/contributorService';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ContributeButtonProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

export function ContributeButton({ groupId, groupName, onSuccess }: ContributeButtonProps) {
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useSupabaseUser();

  const config = {
    public_key: import.meta.env.VITE_FLW_PUBLIC_KEY_PROD || import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '',
    tx_ref: `GROUP_${groupId}_${Date.now()}`,
    amount: parseFloat(amount) || 0,
    currency: 'NGN',
    payment_options: 'card,banktransfer,ussd',
    customer: {
      email: user?.email || '',
      name: user?.name || '',
      phone_number: user?.phone || '',
    },
    customizations: {
      title: `Contribute to ${groupName}`,
      description: `Contributing ₦${amount} to ${groupName}`,
      logo: '',
    },
    // ⭐ CRITICAL: This enables automatic voting rights
    meta: {
      group_id: groupId,
      user_id: user?.id,
      contribution_type: 'group',
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  const handleContribute = () => {
    const contributionAmount = parseFloat(amount);

    if (!contributionAmount || contributionAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (contributionAmount < 100) {
      toast.error('Minimum contribution is ₦100');
      return;
    }

    if (!user) {
      toast.error('Please login to contribute');
      return;
    }

    setIsProcessing(true);

    handleFlutterPayment({
      callback: async (response) => {
        console.log('Payment response:', response);
        closePaymentModal();

        // Check for both 'successful' and 'completed' status
        if (response.status === 'successful' || response.status === 'completed') {
          try {
            // Immediately record as pending contribution
            await ContributorService.recordPendingContribution(
              groupId,
              user!.id,
              contributionAmount,
              {
                txRef: response.tx_ref,
                flwRef: response.flw_ref,
                transactionId: response.transaction_id,
                paymentType: (response as any).payment_type || 'card'
              }
            );

            toast.success('Payment successful! Contribution recorded.', {
              description: 'Your voting rights will be activated shortly.',
              duration: 5000,
            });
            
            setIsOpen(false);
            setAmount('');
            
            // Refresh immediately to show pending contribution
            onSuccess?.();
          } catch (error) {
            console.error('Error recording contribution:', error);
            toast.error('Payment successful but failed to record. Please contact support with reference: ' + response.tx_ref);
          }
        } else {
          toast.error('Payment was not successful. Please try again.');
        }
        
        setIsProcessing(false);
      },
      onClose: () => {
        setIsProcessing(false);
        console.log('Payment modal closed');
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          <CreditCard className="h-4 w-4 mr-2" />
          Contribute to Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contribute to {groupName}</DialogTitle>
          <DialogDescription>
            Contribute via card or bank transfer to gain voting rights in this group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
              step="100"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Minimum contribution: ₦100
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Benefits of Contributing:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✅ Automatic voting rights</li>
              <li>✅ Participate in group decisions</li>
              <li>✅ Access to exclusive features</li>
              <li>✅ Transparent contribution tracking</li>
            </ul>
          </div>

          <Button
            onClick={handleContribute}
            disabled={isProcessing || !amount}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ₦{amount || '0'}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by Flutterwave
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
