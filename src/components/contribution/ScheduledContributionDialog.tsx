import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { Calendar, Loader2, Clock, Wallet, Timer, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import BrandLoader from '@/components/ui/BrandLoader';

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

  const todayLocalIso = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const getSchedulePreview = () => {
    if (!scheduledDate) return null;
    const date = new Date(`${scheduledDate}T${get24HourTime()}`);
    if (!Number.isFinite(date.getTime())) return null;
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) return null;
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (totalHours < 24) {
      return totalHours <= 1 ? 'In under an hour' : `In ${totalHours} hours`;
    }
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `In ${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const relativeWindow = getSchedulePreview();

  return (
    <>
    {isProcessing && (
      <BrandLoader
        variant="overlay"
        badge="Scheduled Contribution"
        message={`Scheduling ₦${parseFloat(amount || '0').toLocaleString()}`}
        submessage={`Queuing automatic deposit for ${groupName}…`}
      />
    )}
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
              min={todayLocalIso}
              disabled={isProcessing}
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              {/* Hours */}
              <Select value={hours} onValueChange={setHours} disabled={isProcessing}>
                <SelectTrigger className="h-11 flex-1 rounded-xl font-semibold tabular-nums">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                    const val = h.toString().padStart(2, '0');
                    return (
                      <SelectItem key={val} value={val} className="tabular-nums">
                        {val}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>

              {/* Minutes */}
              <Select value={minutes} onValueChange={setMinutes} disabled={isProcessing}>
                <SelectTrigger className="h-11 flex-1 rounded-xl font-semibold tabular-nums">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => {
                    const val = m.toString().padStart(2, '0');
                    return (
                      <SelectItem key={val} value={val} className="tabular-nums">
                        {val}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Native Tactile AM/PM Toggle */}
              <div className="grid h-11 grid-cols-2 rounded-xl border bg-muted/50 p-1" role="group" aria-label="AM or PM">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded-lg px-2.5 text-xs font-bold transition-all',
                      period === p
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Selected: {hours}:{minutes} {period}
            </p>
          </div>

          {/* Preview */}
          {amount && scheduledDate && relativeWindow && (
            <div className="rounded-xl border bg-accent/45 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                Scheduled Summary
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                  <span>Amount: <strong className="text-foreground tabular-nums">₦{parseFloat(amount).toLocaleString()}</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-primary" />
                  <span>Date: {new Date(`${scheduledDate}T${get24HourTime()}`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span>Time: {hours}:{minutes} {period}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Timer className="h-4 w-4 shrink-0 text-primary" />
                  <span>{relativeWindow}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  <span>Automatic deduction from your wallet</span>
                </li>
              </ul>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Ensure you have ₦{Number.isFinite(parseFloat(amount)) ? parseFloat(amount).toLocaleString() : '0'} in your wallet on the scheduled date.
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
    </>
  );
}
