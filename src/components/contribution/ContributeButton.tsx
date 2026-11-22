import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { WalletContributionService } from '@/services/supabase/walletContributionService';
import { toast } from 'sonner';
import { Wallet, ArrowUpRight, CreditCard } from 'lucide-react';
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
import BrandLoader from '@/components/ui/BrandLoader';
import CollectiPayReceipt, { type CollectiPayReceiptData } from '@/components/receipt/CollectiPayReceipt';
import { MoneySentAnimation } from '@/components/wallet/MoneySentAnimation';
import { TransactionPinDialog } from '@/components/security/TransactionPinDialog';
import { cn } from '@/lib/utils';
import { GroupRules, groupRuleColumns } from './GroupRules';
import type { GroupRuleDetails } from './GroupRules';
import { supabase } from '@/integrations/supabase/client';
import { WalletService } from '@/services/supabase/walletService';
import { Switch } from '@/components/ui/switch';

interface ContributeButtonProps {
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
  variant?: 'default' | 'hero';
  className?: string;
  rules?: GroupRuleDetails;
}

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000];

export function ContributeButton({
  groupId,
  groupName,
  onSuccess,
  variant = 'default',
  className,
  rules,
}: ContributeButtonProps) {
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipt, setReceipt] = useState<CollectiPayReceiptData | null>(null);
  const { user, refreshCurrentUser } = useSupabaseUser();
  const [anonymousOverride, setAnonymousOverride] = useState<boolean>();
  const isAnonymous = anonymousOverride ?? (user?.preferences as { anonymousContributions?: boolean } | null)?.anonymousContributions === true;
  const [preview, setPreview] = useState<{ id: string; rules: GroupRuleDetails | null }>();
  const [rulesRetry, retryRules] = useState(0);
  const groupRules = rules ?? (preview?.id === groupId ? preview.rules : undefined);

  useEffect(() => {
    if (!isOpen || rules) return;
    let active = true;
    void Promise.resolve(supabase.from("contribution_groups").select(groupRuleColumns).eq("id", groupId).maybeSingle()).then(
      ({ data }) => { if (active) setPreview({ id: groupId, rules: data }); },
      () => { if (active) setPreview({ id: groupId, rules: null }); },
    );
    return () => { active = false; };
  }, [groupId, isOpen, rules, rulesRetry]);

  const walletBalance = Number(user?.wallet_balance || 0);
  const parsedAmount = parseFloat(amount || '0');
  const hasBalance = walletBalance >= parsedAmount;
  const validAmount = /^\d+(?:\.\d{1,2})?$/.test(amount) && parsedAmount >= 100;

  const startCheckout = async () => {
    if (!groupRules || !user?.email || !validAmount || isProcessing) return;
    setIsProcessing(true);
    try {
      const checkout = await WalletService.createPaymentInvoice({
        amount: parsedAmount, description: `Contribution to ${groupName}`,
        customerEmail: user.email, customerName: user.name || user.email,
        userId: user.id, contributionId: groupId, anonymous: isAnonymous,
      });
      if (checkout?.checkoutUrl) window.location.assign(checkout.checkoutUrl);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isProcessing) return;
    setIsOpen(open);
    if (!open) {
      setReceipt(null);
      setPreview(undefined);
      setAnonymousOverride(undefined);
    }
  };

  const handleStartContribution = () => {
    if (!groupRules) return;
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

    if (user.status && user.status !== 'active') {
      toast.error(`Your account is currently ${user.status}. Contributions are disabled.`);
      return;
    }

    if (walletBalance < contributionAmount) {
      toast.error('Insufficient wallet balance', {
        description: `You need ₦${(contributionAmount - walletBalance).toLocaleString()} more`,
      });
      return;
    }

    setPinDialogOpen(true);
  };

  const executeWalletContribution = async (verifiedPin: string) => {
    if (!groupRules || !user) return;
    const contributionAmount = parseFloat(amount);
    setPinDialogOpen(false);
    setIsProcessing(true);

    try {
      const result = await WalletContributionService.contributeFromWallet(
        user.id,
        groupId,
        contributionAmount,
        isAnonymous,
        verifiedPin
      );

      if (result.success) {
        const balanceBefore = walletBalance;
        const balanceAfter =
          typeof result.new_balance === 'number'
            ? result.new_balance
            : Math.max(0, balanceBefore - contributionAmount);

        const reference =
          (result as any).transaction_id ||
          (result as any).reference ||
          `CP-GRP-${Date.now().toString(36).toUpperCase()}`;

        setReceipt({
          kind: 'contribution',
          title: 'Group Contribution',
          amount: contributionAmount,
          status: 'successful',
          date: new Date().toISOString(),
          reference: String(reference),
          groupName,
          paymentMethod: 'CollectiPay Wallet',
          balanceBefore,
          balanceAfter,
          votingRightsGranted: groupRules.enable_voting_rights !== false,
          sender: {
            label: 'From',
            name: user.name || user.email || 'Your Wallet',
            subtitle: 'CollectiPay Wallet',
          },
          recipient: {
            label: 'To Pool',
            name: groupName,
            subtitle: 'Group Contribution Vault',
          },
        });

        setAmount('');
        void refreshCurrentUser();
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error contributing from wallet:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {isProcessing && (
        <BrandLoader
          variant="overlay"
          badge="Group Contribution"
          message={`Pooling ₦${parsedAmount.toLocaleString()}`}
          submessage={`Adding your contribution to ${groupName} & activating voting rights…`}
        />
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className={cn(
              variant === 'hero'
                ? 'wallet-primary-action h-12 w-full rounded-xl font-semibold shadow-sm'
                : 'h-11 w-full rounded-xl font-semibold sm:w-auto',
              className
            )}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Contribute
            {variant === 'hero' && <ArrowUpRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </DialogTrigger>

        <DialogContent
          className={cn(
            receipt
              ? 'max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4'
              : 'max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl'
          )}
        >
          {receipt ? (
            <div className="space-y-3">
              <DialogHeader className="sr-only">
                <DialogTitle>Contribution Receipt</DialogTitle>
                <DialogDescription>Verified CollectiPay group contribution receipt.</DialogDescription>
              </DialogHeader>
              <MoneySentAnimation
                status="sent"
                variant="contribution"
                compact
                amount={receipt.amount}
                recipientName={groupName}
                recipientSubline={
                  receipt.votingRightsGranted
                    ? 'Voting rights unlocked in this group'
                    : 'Added to group balance'
                }
              />
              <CollectiPayReceipt
                data={receipt}
                onDone={() => handleOpenChange(false)}
                doneLabel="Done"
              />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="tracking-tight">Contribute to {groupName}</DialogTitle>
                <DialogDescription>
                  Pay with your wallet, card, or bank. A confirmed in-app payment grants voting rights.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="rounded-xl border p-3">
                  {groupRules ? <GroupRules group={groupRules} /> : groupRules === null ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p>Couldn’t load the group rules.</p>
                      <Button variant="outline" onClick={() => { setPreview(undefined); retryRules((count) => count + 1); }}>Retry</Button>
                    </div>
                  ) : <p role="status" className="text-sm text-muted-foreground">Loading group rules…</p>}
                </div>
                {/* Native Emerald Wallet Balance Pill */}
                <div className="flex items-center justify-between rounded-2xl border bg-accent/55 px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Available balance</p>
                      <p className="text-base font-bold tabular-nums">₦{walletBalance.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
                    Zero fee
                  </span>
                </div>

                {/* Amount Input + Quick Presets */}
                <div className="space-y-2.5">
                  <Label htmlFor="contribute-amount">Amount (₦)</Label>
                  <Input
                    id="contribute-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="100"
                    step="100"
                    disabled={isProcessing}
                    className="h-12 rounded-xl text-lg font-semibold tabular-nums"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        disabled={isProcessing}
                        className={cn(
                          'min-h-9 rounded-lg border text-xs font-semibold tabular-nums transition-colors',
                          parsedAmount === preset
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted'
                        )}
                      >
                        ₦{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {!hasBalance && amount && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertDescription>
                      Your wallet is short by ₦{(parsedAmount - walletBalance).toLocaleString()}. You can pay by card or bank instead.
                    </AlertDescription>
                  </Alert>
                )}

                <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-sm font-medium">
                  Hide my name from the group
                  <Switch checked={isAnonymous} onCheckedChange={setAnonymousOverride} disabled={isProcessing} />
                </label>
                <Button
                  onClick={handleStartContribution}
                  disabled={isProcessing || !groupRules || !validAmount || !hasBalance}
                  className="h-12 w-full rounded-xl font-semibold"
                  size="lg"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Pay from wallet {validAmount ? `· ₦${parsedAmount.toLocaleString()}` : ''}
                </Button>
                <Button type="button" variant="outline" onClick={startCheckout}
                  disabled={isProcessing || !groupRules || !validAmount || !user?.email} className="h-11 w-full gap-2 rounded-xl">
                  <CreditCard size={16} aria-hidden="true" /> Pay by card or bank
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TransactionPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        title="Authorize Contribution"
        description={`Enter your 4-digit PIN to contribute to ${groupName}.`}
        amount={parsedAmount}
        confirmLabel="Contribute Now"
        pending={isProcessing}
        onVerified={executeWalletContribution}
      />
    </>
  );
}
