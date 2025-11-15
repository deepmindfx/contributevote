import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { Calendar, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledContributionDialogProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

// Helper function to format time in 12-hour format with AM/PM
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function ScheduledContributionDialog({ groupId, groupName, onSuccess }: ScheduledContributionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useSupabaseUser();

  const handleSchedule = async () => {
    const contributionAmount = parseFloat(amount);

    if (!contributionAmount || contributionAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (contributionAmount < 100) {
      toast.error('Minimum contribution is ₦100');
      return;
    }

    if (!scheduledDate) {
      toast.error('Please select a date');
      return;
    }

    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    if (dateTime <= new Date()) {
      toast.error('Scheduled date must be in the future');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await WalletContributionService.scheduleContribution(
        user.id,
        groupId,
        contributionAmount,
        dateTime
      );

      if (result) {
        setIsOpen(false);
        setAmount('');
        setScheduledDate('');
        setScheduledTime('12:00');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error scheduling contribution:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getDaysUntil = () => {
    if (!scheduledDate) return null;
    const date = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysUntil = getDaysUntil();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Contribution</DialogTitle>
          <DialogDescription>
            Schedule a one-time contribution to {groupName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="scheduled-amount">Amount (₦)</Label>
            <Input
              id="scheduled-amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
              step="100"
              disabled={isProcessing}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="scheduled-date">Date</Label>
            <Input
              id="scheduled-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              disabled={isProcessing}
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="scheduled-time">Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isProcessing}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {scheduledTime && `Selected: ${formatTime12Hour(scheduledTime)}`}
            </p>
          </div>

          {/* Preview */}
          {amount && scheduledDate && daysUntil !== null && daysUntil > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Scheduled Summary
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>💰 Amount: ₦{parseFloat(amount).toLocaleString()}</li>
                <li>📅 Date: {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</li>
                <li>🕐 Time: {formatTime12Hour(scheduledTime)}</li>
                <li>⏰ In {daysUntil} {daysUntil === 1 ? 'day' : 'days'}</li>
                <li>⚡ Will be deducted from your wallet</li>
              </ul>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Ensure you have ₦{amount || '0'} in your wallet on the scheduled date
            </p>
          </div>

          {/* Schedule Button */}
          <Button
            onClick={handleSchedule}
            disabled={isProcessing || !amount || !scheduledDate}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Contribution
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
