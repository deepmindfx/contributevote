import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { toast } from 'sonner';
import { Wallet, Loader2, Zap } from 'lucide-react';
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
        // SECURITY NOTE: This localStorage update is ONLY for UI optimization
        // to prevent showing stale balance during the 2-second reload delay.
        // The database is the ONLY source of truth. Any manual localStorage
        // edits will be overwritten when:
        // 1. Page reloads (fetches from DB)
        // 2. User logs in again (fetches from DB)
        // 3. Any transaction occurs (validates against DB)
        // All transactions validate current balance from DB before processing.
        if (user && result.new_balance !== undefined) {
          const updatedUser = { ...user, wallet_balance: result.new_balance };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
        
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
            Contribute instantly from your wallet
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

          {/* Insufficient Balance Warning */}
          {!hasBalance && amount && (
            <Alert variant="destructive">
              <AlertDescription>
                Insufficient balance. You need ₦{(parseFloat(amount) - walletBalance).toLocaleString()} more.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Benefits Display */}
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" />
              Instant Contribution Benefits
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>⚡ Instant voting rights</li>
              <li>💰 No transaction fees</li>
              <li>✅ Immediate confirmation</li>
              <li>🔒 Secure & fast</li>
            </ul>
          </div>

          {/* Contribute Button */}
          <Button
            onClick={handleWalletContribution}
            disabled={isProcessing || !amount || !hasBalance}
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
                <Wallet className="h-4 w-4 mr-2" />
                Contribute ₦{amount || '0'}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Instant contribution from your wallet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
