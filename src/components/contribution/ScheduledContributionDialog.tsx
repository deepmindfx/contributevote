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

export function ScheduledContributionDialog({ groupId, groupName, onSuccess }: ScheduledContributionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [hours, setHours] = useState('12');
  const [minutes, setMinutes] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useSupabaseUser();

  // Convert 12-hour time to 24-hour format
  const get24HourTime = () => {
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  };

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

    const dateTime = new Date(`${scheduledDate}T${get24HourTime()}`);
    
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
        setHours('12');
        setMinutes('00');
        setPeriod('PM');
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
    const date = new Date(`${scheduledDate}T${get24HourTime()}`);
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
            <Label>Time</Label>
            <div className="flex gap-2">
              {/* Hours */}
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={isProcessing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h.toString().padStart(2, '0')}>
                    {h.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>

              <span className="flex items-center text-2xl font-bold">:</span>

              {/* Minutes */}
              <select
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                disabled={isProcessing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m.toString().padStart(2, '0')}>
                    {m.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>

              {/* AM/PM */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'AM' | 'PM')}
                disabled={isProcessing}
                className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Selected: {hours}:{minutes} {period}
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
                <li>📅 Date: {new Date(`${scheduledDate}T${get24HourTime()}`).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</li>
                <li>🕐 Time: {hours}:{minutes} {period}</li>
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
