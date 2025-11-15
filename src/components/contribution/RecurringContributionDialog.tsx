import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { Repeat, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleCreate = async () => {
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
      toast.error('Please login to continue');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await WalletContributionService.createRecurringContribution(
        user.id,
        groupId,
        contributionAmount,
        frequency,
        new Date(),
        endDate ? new Date(endDate) : undefined
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
              min={new Date().toISOString().split('T')[0]}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for indefinite contributions
            </p>
          </div>

          {/* Preview */}
          {amount && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Summary</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>💰 Amount: ₦{parseFloat(amount).toLocaleString()} {frequency}</li>
                <li>📅 Next contribution: {getNextContributionDate()}</li>
                <li>⚡ Automatic from your wallet</li>
                {endDate && <li>🏁 Ends: {new Date(endDate).toLocaleDateString()}</li>}
              </ul>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Ensure you have sufficient wallet balance on contribution dates
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
  );
}
