import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { Repeat, Loader2, Calendar, Wallet, Zap, Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import BrandLoader from '@/components/ui/BrandLoader';

interface RecurringContributionDialogProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

export function RecurringContributionDialog({ groupId, groupName, onSuccess }: RecurringContributionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [endDate, setEndDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useSupabaseUser();

  const todayLocalIso = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const handleCreate = async () => {
    const contributionAmount = parseFloat(amount);

    if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (contributionAmount < 100) {
      toast.error('Minimum contribution is ₦100');
      return;
    }

    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    let parsedEndDate: Date | undefined;
    if (endDate) {
      parsedEndDate = new Date(`${endDate}T23:59:59`);
      const firstRun = WalletContributionService.calculateNextContributionDate(frequency, new Date());
      if (!Number.isFinite(parsedEndDate.getTime()) || parsedEndDate <= firstRun) {
        toast.error(`End date must be after the first scheduled run (${firstRun.toLocaleDateString()})`);
        return;
      }
    }

    setIsProcessing(true);

    try {
      const result = await WalletContributionService.createRecurringContribution(
        user.id,
        groupId,
        contributionAmount,
        frequency,
        new Date(),
        parsedEndDate
      );

      if (result) {
        setIsOpen(false);
        setAmount('');
        setEndDate('');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error creating recurring contribution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getNextContributionDate = () => {
    const date = new Date();
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.toLocaleDateString();
  };

  return (
    <>
    {isProcessing && (
      <BrandLoader
        variant="overlay"
        badge="Auto-Save Plan"
        message={`Setting up ₦${parseFloat(amount || '0').toLocaleString()} ${frequency}`}
        submessage={`Scheduling recurring contributions to ${groupName}…`}
      />
    )}
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Repeat className="h-4 w-4 mr-2" />
          Set Recurring
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recurring Contribution</DialogTitle>
          <DialogDescription>
            Set up automatic contributions to {groupName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="recurring-amount">Amount (₦)</Label>
            <Input
              id="recurring-amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
              step="100"
              disabled={isProcessing}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* End Date (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date (Optional)</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={todayLocalIso}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for indefinite contributions
            </p>
          </div>

          {/* Preview */}
          {amount && (
            <div className="rounded-xl border bg-accent/45 p-4">
              <h4 className="mb-2 text-sm font-semibold">Summary</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                  <span>Amount: <strong className="text-foreground tabular-nums">₦{parseFloat(amount).toLocaleString()}</strong> {frequency}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-primary" />
                  <span>Next contribution: {getNextContributionDate()}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  <span>Automatic zero-fee deduction from wallet</span>
                </li>
                {endDate && (
                  <li className="flex items-center gap-2">
                    <Flag className="h-4 w-4 shrink-0 text-primary" />
                    <span>Ends: {new Date(endDate).toLocaleDateString()}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Ensure you have sufficient wallet balance on contribution dates.
            </p>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={isProcessing || !amount}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Repeat className="h-4 w-4 mr-2" />
                Create Recurring Contribution
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
