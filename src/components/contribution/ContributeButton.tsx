import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { ContributorService } from '@/services/supabase/contributorService';
import { WalletService } from '@/services/supabase/walletService';
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



  const handleContribute = async () => {
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

    try {
      // Create payment invoice using the same system as wallet funding
      const invoice = await WalletService.createPaymentInvoice({
        amount: contributionAmount,
        description: `Contribution to ${groupName}`,
        customerEmail: user.email || '',
        customerName: user.name || '',
        userId: user.id,
        contributionId: groupId
      });

      if (!invoice || !invoice.checkoutUrl) {
        toast.error('Failed to create payment. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Record as pending contribution immediately
      await ContributorService.recordPendingContribution(
        groupId,
        user.id,
        contributionAmount,
        {
          txRef: invoice.invoiceReference,
          flwRef: invoice.invoiceReference,
          transactionId: invoice.invoiceReference,
          paymentType: 'invoice'
        }
      );

      // Redirect to Flutterwave checkout
      window.open(invoice.checkoutUrl, '_blank');
      
      toast.success('Payment link opened! Complete payment in the new tab.', {
        description: 'Your contribution will be recorded after successful payment.',
        duration: 8000,
      });
      
      setIsOpen(false);
      setAmount('');
      
      // Refresh to show pending contribution
      onSuccess?.();

    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to create payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
