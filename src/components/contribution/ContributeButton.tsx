import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { WalletService } from '@/services/supabase/walletService';
import { toast } from 'sonner';
import { Wallet, CreditCard, Loader2, Zap, Calendar, Repeat } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ContributeButtonProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

export function ContributeButton({ groupId, groupName, onSuccess }: ContributeButtonProps) {
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'checkout'>('wallet');
  const { user } = useSupabaseUser();

  const walletBalance = user?.wallet_balance || 0;
  const hasBalance = walletBalance >= parseFloat(amount || '0');



  const handleWalletContribution = async () => {
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

    if (walletBalance < contributionAmount) {
      toast.error('Insufficient wallet balance', {
        description: `You need ₦${contributionAmount - walletBalance} more`
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await WalletContributionService.contributeFromWallet(
        user.id,
        groupId,
        contributionAmount,
        false // not anonymous
      );

      if (result.success) {
        setIsOpen(false);
        setAmount('');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error contributing from wallet:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutContribution = async () => {
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
        return;
      }

      window.open(invoice.checkoutUrl, '_blank');
      
      toast.success('Payment link opened!', {
        description: 'Complete payment in the new tab.',
        duration: 8000,
      });
      
      setIsOpen(false);
      setAmount('');
      onSuccess?.();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to create payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContribute = () => {
    if (paymentMethod === 'wallet') {
      handleWalletContribution();
    } else {
      handleCheckoutContribution();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          <Wallet className="h-4 w-4 mr-2" />
          Contribute to Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contribute to {groupName}</DialogTitle>
          <DialogDescription>
            Choose your preferred payment method
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Balance Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Wallet Balance</span>
              <span className="text-lg font-bold">₦{walletBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Amount Input */}
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

          {/* Payment Method Tabs */}
          <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallet" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="checkout" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Card
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wallet" className="space-y-3">
              {!hasBalance && amount && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Insufficient balance. You need ₦{(parseFloat(amount) - walletBalance).toLocaleString()} more.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  Instant Contribution
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>⚡ Instant voting rights</li>
                  <li>💰 No transaction fees</li>
                  <li>✅ Immediate confirmation</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="checkout" className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Card Payment</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>💳 Pay with any card</li>
                  <li>🔒 Secure checkout</li>
                  <li>⏱️ Voting rights after confirmation</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          {/* Contribute Button */}
          <Button
            onClick={handleContribute}
            disabled={isProcessing || !amount || (paymentMethod === 'wallet' && !hasBalance)}
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
                {paymentMethod === 'wallet' ? (
                  <Wallet className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Contribute ₦{amount || '0'}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {paymentMethod === 'wallet' 
              ? 'Instant contribution from your wallet'
              : 'Secure payment powered by Flutterwave'
            }
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
