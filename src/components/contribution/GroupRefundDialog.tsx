import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GroupRefundDialogProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

export function GroupRefundDialog({ groupId, groupName, onSuccess }: GroupRefundDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [percentage, setPercentage] = useState('100');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useSupabaseUser();

  const MIN_REASON_LENGTH = 20;

  const handleCreateRequest = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    if (reason.length < MIN_REASON_LENGTH) {
      toast.error(`Please provide a more detailed reason (at least ${MIN_REASON_LENGTH} characters)`);
      return;
    }

    if (refundType === 'partial') {
      const pct = parseFloat(percentage);
      if (!pct || pct <= 0 || pct > 100) {
        toast.error('Please enter a valid percentage (1-100)');
        return;
      }
    }

    if (!user) {
      toast.error('Please login to continue');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await WalletContributionService.createRefundRequest(
        groupId,
        user.id,
        reason,
        refundType,
        refundType === 'partial' ? parseFloat(percentage) : undefined
      );

      if (result) {
        setIsOpen(false);
        setReason('');
        setRefundType('full');
        setPercentage('100');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error creating refund request:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700">
          <RefreshCw className="h-4 w-4 mr-2" />
          Request Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Group Refund</DialogTitle>
          <DialogDescription>
            Request a refund for all contributors in {groupName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will initiate a vote among all contributors. A majority (&gt;50%) must approve for the refund to be processed.
            </AlertDescription>
          </Alert>

          {/* Refund Type */}
          <div className="space-y-3">
            <Label>Refund Type</Label>
            <RadioGroup value={refundType} onValueChange={(v: any) => setRefundType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="cursor-pointer">
                  Full Refund (100%)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="cursor-pointer">
                  Partial Refund
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Percentage (if partial) */}
          {refundType === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="percentage">Refund Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="percentage"
                  type="number"
                  placeholder="Enter percentage"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  min="1"
                  max="100"
                  disabled={isProcessing}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Refund</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you're requesting a refund..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isProcessing}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/{MIN_REASON_LENGTH} characters minimum
            </p>
          </div>

          {/* Governance Rules */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Transparent Governance Rules
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white dark:bg-gray-900 p-2 rounded text-center">
                <div className="text-lg font-bold text-blue-600">60%</div>
                <div className="text-xs text-muted-foreground">Approval</div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded text-center">
                <div className="text-lg font-bold text-green-600">70%</div>
                <div className="text-xs text-muted-foreground">Participation</div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-2 rounded text-center">
                <div className="text-lg font-bold text-purple-600">7</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                <span>All contributors will be notified immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                <span><strong>70% must vote</strong> (participation threshold)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                <span><strong>60% must approve</strong> (of those who voted)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">4.</span>
                <span><strong>Early approval:</strong> If both thresholds met, approved immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">5.</span>
                <span>After 7 days: Auto-reject if thresholds not met</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">6.</span>
                <span>Refund is proportional to each contributor's amount</span>
              </li>
            </ul>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreateRequest}
            disabled={isProcessing || !reason.trim()}
            className="w-full"
            size="lg"
            variant="destructive"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Request...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Create Refund Request
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
