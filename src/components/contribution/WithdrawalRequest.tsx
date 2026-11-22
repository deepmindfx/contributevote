import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { Wallet, AlertCircle, Vote, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BrandLoader from '@/components/ui/BrandLoader';
import { TransactionPinDialog } from '@/components/security/TransactionPinDialog';
import { getGroupWithdrawalPolicy, naira, withdrawalFee } from '@/services/supabase/pricingService';
import {
  createWithdrawalRequest,
  processInstantWithdrawal,
} from '@/services/supabase/withdrawalService';

interface WithdrawalRequestProps {
  groupId: string;
}

export function WithdrawalRequest({ groupId }: WithdrawalRequestProps) {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { contributions, refreshContributionData } = useSupabaseContribution();
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rate, setRate] = useState<number>();
  const [pricingError, setPricingError] = useState(false);
  const [pricingVersion, setPricingVersion] = useState(0);

  const group: any = contributions.find((c) => c.id === groupId);
  const availableBalance = Number(group?.current_amount || 0);
  const charity = group?.category === 'charity';
  const effectiveRate = charity ? 0 : rate;
  const gross = Number(amount);
  const fee = effectiveRate === undefined ? undefined : withdrawalFee(gross, effectiveRate);
  const groupHasVotingRights = group?.enable_voting_rights !== false;
  const approvalThreshold =
    group?.voting_threshold && group.voting_threshold >= 50 && group.voting_threshold <= 100
      ? Math.round(group.voting_threshold)
      : 60;
  const eligibleVoterCount = Array.isArray(group?.contributors)
    ? group.contributors.filter((c: any) => c.has_voting_rights === true && c.user_id).length
    : 0;

  const reloadPricing = () => {
    setRate(undefined);
    setPricingError(false);
    setPricingVersion((version) => version + 1);
  };

  useEffect(() => {
    let active = true;
    setRate(undefined);
    setPricingError(false);
    void getGroupWithdrawalPolicy(groupId).then(
      (pricing) => { if (active) setRate(pricing.percent); },
      () => { if (active) setPricingError(true); },
    );
    return () => { active = false; };
  }, [groupId, pricingVersion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !groupId) {
      toast.error('User not authenticated');
      return;
    }

    const withdrawalAmount = parseFloat(amount);

    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(withdrawalAmount) || withdrawalAmount < 0.01) {
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

    if (fee !== undefined) setPinDialogOpen(true);
  };

  const executeWithdrawal = async (verifiedPin: string) => {
    if (fee === undefined || isSubmitting) return;
    const withdrawalAmount = parseFloat(amount);
    setPinDialogOpen(false);
    setIsSubmitting(true);

    try {
      if (!groupHasVotingRights) {
        const result = await processInstantWithdrawal(groupId, withdrawalAmount, purpose.trim(), verifiedPin, fee);
        if (!result.success) {
          throw new Error(result.error || 'Failed to process withdrawal');
        }

        toast.success(`${naira.format(withdrawalAmount - fee)} credited to your wallet`);
        setAmount('');
        setPurpose('');
        await Promise.all([refreshCurrentUser(), refreshContributionData(true)]);
        return;
      }

      // Atomic server-side RPC verifies PIN, creates the withdrawal request, and notifies all verified voters
      const result = await createWithdrawalRequest(groupId, withdrawalAmount, purpose.trim(), verifiedPin, fee);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create withdrawal request');
      }

      toast.success(
        `Withdrawal vote opened! ${result.data?.eligible_voters || eligibleVoterCount} eligible voter(s) can now vote.`
      );
      setAmount('');
      setPurpose('');
      await refreshContributionData(true);
    } catch (error: any) {
      console.error('Error creating withdrawal request:', error);
      toast.error(error?.message || 'Failed to create withdrawal request');
      if (error?.message?.startsWith('The withdrawal fee changed')) reloadPricing();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isSubmitting && (
        <BrandLoader
          variant="overlay"
          badge={groupHasVotingRights ? 'Opening Vote' : 'Direct Payout'}
          message={groupHasVotingRights ? 'Opening withdrawal vote' : 'Processing direct withdrawal'}
          submessage={
            groupHasVotingRights
              ? 'Notifying all eligible group voters…'
              : 'Transferring funds from pool to your wallet…'
          }
        />
      )}

      <div className="space-y-4">
        <Alert className="rounded-2xl">
          {groupHasVotingRights ? (
            <Vote className="h-4 w-4 text-primary" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" />
          )}
          <AlertDescription className="text-xs leading-relaxed">
            {groupHasVotingRights ? (
              <>
                <strong>Vote-governed pool:</strong> At least{' '}
                <strong>70% of members must vote</strong> and{' '}
                <strong>{approvalThreshold}% must say yes</strong> within 7 days before funds are released.
                {eligibleVoterCount > 0 ? (
                  <span> Currently <strong>{eligibleVoterCount}</strong> eligible voter{eligibleVoterCount === 1 ? '' : 's'}.</span>
                ) : (
                  <span className="mt-1 block font-semibold text-amber-700 dark:text-amber-300">
                    No verified contributors with voting rights yet — contribute from wallet or verify a bank transfer first.
                  </span>
                )}
              </>
            ) : (
              <>
                <strong>Admin-managed pool:</strong> Voting is disabled for this group. Withdrawals credit your wallet immediately.
              </>
            )}
          </AlertDescription>
        </Alert>

        <Card className="rounded-2xl p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-foreground">
                  {groupHasVotingRights ? 'Propose Withdrawal Vote' : 'Withdraw Pool Funds'}
                </h3>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Available balance: <strong className="text-foreground">₦{availableBalance.toLocaleString()}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawal-amount">Amount (₦)</Label>
                <Input
                  id="withdrawal-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={availableBalance}
                  min="0.01"
                  step="0.01"
                  className="h-11 rounded-xl font-semibold tabular-nums"
                  required
                />
              </div>

              <div className="rounded-xl bg-accent/45 p-3 text-sm">
                {effectiveRate !== undefined ? (
                  <>
                    <p className="font-semibold">{charity ? 'Charity groups pay no withdrawal fee' : `${effectiveRate}% group withdrawal fee`}</p>
                    {gross > 0 && fee !== undefined && (
                      <dl className="wallet-value-rows mt-1">
                        <div><dt>Fee deducted from withdrawal</dt><dd>{naira.format(fee)}</dd></div>
                        <div><dt>Wallet receives</dt><dd>{naira.format(gross - fee)}</dd></div>
                      </dl>
                    )}
                  </>
                ) : pricingError ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p role="status">Couldn’t load the withdrawal fee.</p>
                    <Button variant="outline" type="button" onClick={reloadPricing}>Retry</Button>
                  </div>
                ) : <p role="status">Loading withdrawal fee…</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawal-purpose">Purpose</Label>
                <Textarea
                  id="withdrawal-purpose"
                  placeholder="Explain clearly how these funds will be used so members can vote with confidence…"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="rounded-xl"
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl font-bold"
                disabled={
                  isSubmitting || fee === undefined ||
                  availableBalance <= 0 ||
                  (groupHasVotingRights && eligibleVoterCount === 0)
                }
              >
                {isSubmitting
                  ? 'Processing…'
                  : groupHasVotingRights
                  ? 'Submit for Member Vote'
                  : 'Withdraw to Wallet'}
              </Button>

              {availableBalance <= 0 && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No funds available in this pool yet
                </p>
              )}
            </form>
          </div>
        </Card>
      </div>

      <TransactionPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        title={groupHasVotingRights ? 'Authorize Withdrawal Vote' : 'Authorize Pool Withdrawal'}
        description={
          groupHasVotingRights
            ? `Enter your PIN to open the vote. The wallet receives ${naira.format(gross - (fee ?? 0))} after the ${naira.format(fee ?? 0)} fee.`
            : `Enter your PIN to receive ${naira.format(gross - (fee ?? 0))} after the ${naira.format(fee ?? 0)} fee.`
        }
        amount={parseFloat(amount) || 0}
        confirmLabel={groupHasVotingRights ? 'Open Vote' : 'Withdraw Now'}
        pending={isSubmitting}
        onVerified={executeWithdrawal}
      />
    </>
  );
}
