import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { Wallet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  createWithdrawalRequest, 
  processInstantWithdrawal 
} from '@/services/supabase/withdrawalService';

interface WithdrawalRequestProps {
  groupId: string;
}

export function WithdrawalRequest({ groupId }: WithdrawalRequestProps) {
  const { user } = useSupabaseUser();
  const { contributions, refreshContributionData } = useSupabaseContribution();
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const group = contributions.find(c => c.id === groupId);
  const availableBalance = group?.current_amount || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !groupId) {
      toast.error('User not authenticated');
      return;
    }

    const withdrawalAmount = parseFloat(amount);

    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (withdrawalAmount > availableBalance) {
      toast.error(`Amount exceeds available balance (₦${availableBalance.toLocaleString()})`);
      return;
    }

    if (!purpose.trim()) {
      toast.error('Please provide a purpose for this withdrawal');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if group has voting rights enabled
      const groupHasVotingRights = group?.enable_voting_rights !== false;

      if (!groupHasVotingRights) {
        // For non-voting groups, process withdrawal immediately using service
        const result = await processInstantWithdrawal(groupId, withdrawalAmount, purpose.trim());

        if (!result.success) {
          throw new Error(result.error || 'Failed to process withdrawal');
        }

        toast.success(`₦${withdrawalAmount.toLocaleString()} withdrawn successfully and added to your wallet!`);
        
        // Reset form
        setAmount('');
        setPurpose('');
        
        // Refresh data
        await refreshContributionData();
        return;
      }

      // For voting groups, create withdrawal request using service
      const result = await createWithdrawalRequest(groupId, withdrawalAmount, purpose.trim());

      if (!result.success) {
        throw new Error(result.error || 'Failed to create withdrawal request');
      }

      const data = result.data;

      // Get all contributors for this group to notify them
      // @ts-ignore - Supabase type inference issue with deep queries
      const { data: contributors } = await supabase
        .from('contributors')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('has_voting_rights', true);

      // Create notifications for all contributors with voting rights
      if (contributors && contributors.length > 0) {
        const notifications = contributors
          .filter(c => c.user_id !== user.id) // Don't notify the requester
          .map(c => ({
            user_id: c.user_id,
            type: 'withdrawal_request',
            title: 'New Withdrawal Request',
            message: `${user.name} requested ₦${withdrawalAmount.toLocaleString()} withdrawal from ${group?.name}. Vote now!`,
            related_id: data.id,
            is_read: false,
            created_at: new Date().toISOString()
          }));

        if (notifications.length > 0) {
          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }

      toast.success('Withdrawal request submitted! All contributors have been notified.');
      
      // Reset form
      setAmount('');
      setPurpose('');
      
      // Refresh data
      await refreshContributionData();
    } catch (error: any) {
      console.error('Error creating withdrawal request:', error);
      toast.error(error.message || 'Failed to create withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {group?.enable_voting_rights !== false ? (
            <>
              Withdrawal requests require approval from contributors with voting rights.
              The voting period is 24 hours. Once approved, funds will be transferred to your wallet.
            </>
          ) : (
            <>
              This group has no voting rights. As admin, you can withdraw funds instantly without approval.
              Funds will be transferred directly to your wallet.
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Request Withdrawal</h3>
              <p className="text-sm text-muted-foreground">
                Available Balance: ₦{availableBalance.toLocaleString()}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={availableBalance}
                step="0.01"
                required
              />
              <p className="text-xs text-muted-foreground">
                Maximum: ₦{availableBalance.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Textarea
                id="purpose"
                placeholder="Explain why you need to withdraw these funds..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Be clear about how the funds will be used. This helps contributors make informed voting decisions.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || availableBalance <= 0}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Withdrawal Request'}
            </Button>

            {availableBalance <= 0 && (
              <p className="text-sm text-amber-600 text-center">
                No funds available for withdrawal
              </p>
            )}
          </form>
        </div>
      </Card>
    </div>
  );
}
