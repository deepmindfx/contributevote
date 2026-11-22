import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BarChart3, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPricingReport, naira, savePlatformPricing } from "@/services/supabase/pricingService";
import type { PricingReport } from "@/services/supabase/pricingService";

const feeDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export function AdminPricingRevenue() {
  const [report, setReport] = useState<PricingReport>();
  const [dailyFree, setDailyFree] = useState("");
  const [fridayFree, setFridayFree] = useState(false);
  const [percent, setPercent] = useState("");
  const [bankEnabled, setBankEnabled] = useState(true);
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [smallFee, setSmallFee] = useState("");
  const [largeFee, setLargeFee] = useState("");
  const [threshold, setThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    void getPricingReport().then((result) => {
      if (!active) return;
      setReport(result);
      setDailyFree(String(result.pricing.daily_free_transfers));
      setFridayFree(result.pricing.friday_free);
      setPercent(String(result.pricing.group_withdrawal_percent));
      setBankEnabled(result.pricing.bank_transfer_fees_enabled);
      setGroupEnabled(result.pricing.group_withdrawal_fees_enabled);
      setSmallFee(String(result.pricing.bank_transfer_small_fee));
      setLargeFee(String(result.pricing.bank_transfer_large_fee));
      setThreshold(String(result.pricing.bank_transfer_threshold));
    }, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [version]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !report) return;
    setSaving(true);
    try {
      await savePlatformPricing({
        daily_free_transfers: Number(dailyFree), friday_free: fridayFree,
        bank_transfer_fees_enabled: bankEnabled, bank_transfer_small_fee: Number(smallFee),
        bank_transfer_large_fee: Number(largeFee), bank_transfer_threshold: Number(threshold),
        group_withdrawal_fees_enabled: groupEnabled, group_withdrawal_percent: Number(percent),
      });
      setVersion((count) => count + 1);
      toast.success("Pricing settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save pricing.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError || !report) {
    return <Card className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4 text-sm">
      <p role="status">{loadError ? "Couldn’t load pricing and revenue." : "Loading pricing and revenue…"}</p>
      {loadError && <Button variant="outline" onClick={() => setVersion((count) => count + 1)}>Retry</Button>}
    </Card>;
  }

  const revenueCards = [
    ["Total collected", report.revenue.total],
    ["Last 30 days", report.revenue.last_30_days],
    ["Bank transfer fees", report.revenue.bank_transfer],
    ["Group withdrawal fees", report.revenue.group_withdrawal],
    ["Group creation fees", report.revenue.group_creation ?? 0],
  ] as const;
  const recentCreationFees = report.recent_group_creation_fees ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 size={20} className="text-primary" aria-hidden="true" /> Fee revenue</h2>
          <p className="mt-1 text-sm text-muted-foreground">Collected fees from bank transfers, group withdrawals, and paid group creation, before provider costs.</p>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {revenueCards.map(([label, amount]) => (
            <div key={label} className="rounded-xl border bg-accent/35 p-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-xl font-semibold tracking-tight tabular-nums">{naira.format(amount)}</dd>
            </div>
          ))}
        </dl>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Recent group creation fees</h3>
          <p className="text-sm text-muted-foreground">{report.revenue.group_creation_count ?? 0} recorded group creation fees with a verified wallet debit</p>
          {recentCreationFees.length > 0 && <ul className="divide-y rounded-xl border px-3">
            {recentCreationFees.map((fee) => (
              <li key={fee.transaction_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium">{fee.group_name || "Group creation"}</p>
                  <time dateTime={fee.earned_at} className="text-xs text-muted-foreground">{feeDate.format(new Date(fee.earned_at))}</time>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{naira.format(fee.amount)}</span>
              </li>
            ))}
          </ul>}
        </section>
      </Card>
      <Card className="rounded-2xl p-4 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Tag size={19} className="text-primary" aria-hidden="true" /> Pricing settings</h2>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <Label htmlFor="pricing-bank-switch">Charge bank transfer fees</Label>
            <Switch id="pricing-bank-switch" checked={bankEnabled} onCheckedChange={setBankEnabled} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pricing-bank-threshold">Fee threshold (₦)</Label>
              <Input id="pricing-bank-threshold" type="number" min="100" max="500000" step="0.01" required value={threshold} onChange={(event) => setThreshold(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-small-fee">Fee up to threshold (₦)</Label>
              <Input id="pricing-small-fee" type="number" min="0" max="500000" step="0.01" required value={smallFee} onChange={(event) => setSmallFee(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-large-fee">Fee above threshold (₦)</Label>
              <Input id="pricing-large-fee" type="number" min="0" max="500000" step="0.01" required value={largeFee} onChange={(event) => setLargeFee(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricing-daily-free">Free bank transfers per user per day</Label>
            <Input id="pricing-daily-free" value={dailyFree} onChange={(event) => setDailyFree(event.target.value)} type="number" min="0" max="100" step="1" required />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="pricing-friday">Unlimited free transfers on Fridays</Label>
              <p className="mt-1 text-xs text-muted-foreground">Uses Lagos time for all supported banks.</p>
            </div>
            <Switch id="pricing-friday" checked={fridayFree} onCheckedChange={setFridayFree} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <Label htmlFor="pricing-group-switch">Charge group withdrawal fees by default</Label>
            <Switch id="pricing-group-switch" checked={groupEnabled} onCheckedChange={setGroupEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricing-group-rate">Group withdrawal fee (%)</Label>
            <Input id="pricing-group-rate" value={percent} onChange={(event) => setPercent(event.target.value)} type="number" min="0" max="99.99" step="0.01" required />
            <p className="text-xs text-muted-foreground">Charity groups are exempt. Set exceptions for individual groups under Transaction analytics.</p>
          </div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save pricing"}</Button>
        </form>
      </Card>
    </div>
  );
}
