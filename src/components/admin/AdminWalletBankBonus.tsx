import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { walletBankBonusOfferKey } from "@/hooks/useWalletBankBonus";
import { naira } from "@/services/supabase/pricingService";
import { getWalletBankBonusReport, updateWalletBankBonus } from "@/services/supabase/walletBankBonusService";

export function AdminWalletBankBonus() {
  const { user } = useSupabaseUser();
  const reportKey = ["admin-wallet-bank-bonus", user?.id] as const;
  const client = useQueryClient();
  const { data: report, isError, refetch } = useQuery({
    queryKey: reportKey,
    queryFn: getWalletBankBonusReport,
    refetchInterval: 30_000,
    retry: false,
  });
  const [draft, setDraft] = useState<{ enabled?: boolean; amount?: string; limit?: string }>({});
  const save = useMutation({
    mutationFn: ({ enabled, amount, limit }: { enabled: boolean; amount: number; limit: number }) =>
      updateWalletBankBonus(enabled, amount, limit),
    onSuccess(updated) {
      client.setQueryData(reportKey, updated);
      void client.invalidateQueries({ queryKey: walletBankBonusOfferKey });
      setDraft({});
      toast.success("Bank account bonus settings saved.");
    },
    onError(error) {
      toast.error(error.message);
      void refetch();
    },
  });

  if (isError || !report) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4 text-sm">
        <p role="status">{isError ? "Couldn’t load the bank account bonus." : "Loading the bank account bonus…"}</p>
        {isError && <Button variant="outline" onClick={() => void refetch()}>Retry</Button>}
      </Card>
    );
  }

  const enabled = draft.enabled ?? report.enabled;
  const amount = draft.amount ?? String(report.amount);
  const limit = draft.limit ?? String(report.claim_limit);
  const limitReached = report.remaining === 0;
  const needsHigherLimit = enabled && Number(limit) <= report.claimed;
  const edited = enabled !== report.enabled || Number(amount) !== report.amount || Number(limit) !== report.claim_limit;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || needsHigherLimit || !edited) return;
    save.mutate({ enabled, amount: Number(amount), limit: Number(limit) });
  }

  return (
    <Card className="space-y-5 rounded-2xl p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Gift size={19} aria-hidden="true" /></span>
        <div>
          <h2 className="text-lg font-semibold">Bank account bonus</h2>
          <p className="text-sm text-muted-foreground">Reward users who verify their BVN with Flutterwave and open their first personal bank account.</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {([
          ["Accounts credited", report.claimed.toLocaleString("en-NG")],
          ["Spots available", report.enabled ? report.remaining.toLocaleString("en-NG") : "0"],
          ["Total credited", naira.format(report.total_credited)],
        ] as const).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl bg-muted/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="wallet-bonus-active">Offer active</Label>
            <p id="wallet-bonus-status" className="text-xs text-muted-foreground">
              {!report.verification_ready ? "Waiting for Flutterwave BVN verification setup."
                : limitReached ? "Limit reached. Raise the cap to reopen the offer."
                : report.enabled ? "Accepting new claims." : "Paused."}
            </p>
          </div>
          <Switch id="wallet-bonus-active" checked={enabled} disabled={save.isPending || !report.verification_ready} aria-describedby="wallet-bonus-status"
            onCheckedChange={(value) => setDraft({ ...draft, enabled: value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wallet-bonus-amount">Credit amount (₦)</Label>
            <Input id="wallet-bonus-amount" type="number" inputMode="decimal" min={100} max={9999999999999.99} step="0.01" required
              value={amount} disabled={save.isPending} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-bonus-limit">Total account cap</Label>
            <Input id="wallet-bonus-limit" type="number" inputMode="numeric" min={Math.max(1, report.claimed)} max={2147483647} step="1" required
              value={limit} disabled={save.isPending} onChange={(event) => setDraft({ ...draft, limit: event.target.value })} />
          </div>
        </div>
        <Button className="min-h-11" type="submit" disabled={save.isPending || needsHigherLimit || !edited}>
          {save.isPending ? "Saving…" : "Save bonus settings"}
        </Button>
      </form>
    </Card>
  );
}
