import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BulkTransferDetails, bulkMoney, bulkStatus } from "@/components/wallet/BulkTransferDetails";
import { getBulkTransferBatch, getBulkTransferHistory, getBulkTransferSettings, runBulkTransfer, saveBulkTransferSettings } from "@/services/supabase/bulkTransferService";
import type { BulkTransferSettings } from "@/services/supabase/bulkTransferService";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

const fields = [
  ["max_recipients", "Recipients per batch", "1", 2, 50],
  ["max_batch_amount", "Maximum batch amount (₦)", "0.01", 200, 25000000],
  ["daily_amount_limit", "Daily limit per sender (₦)", "0.01", 200, 50000000],
  ["small_fee", "Fee through ₦5,000 (₦)", "0.01", 0, 5000],
  ["medium_fee", "Fee from ₦5,000.01 through ₦50,000 (₦)", "0.01", 0, 5000],
  ["large_fee", "Fee above ₦50,000 (₦)", "0.01", 0, 5000],
  ["vat_percent", "VAT on transfer fees (%)", "0.01", 0, 100],
] as const;

function BulkPricing({ settings, onSaved }: { settings: BulkTransferSettings; onSaved: () => Promise<unknown> }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const next = { ...settings, enabled };
    for (const [name] of fields) next[name] = Number(form.get(name));
    if (next.daily_amount_limit < next.max_batch_amount) { setError("The daily limit must be at least the maximum batch amount."); return; }
    setBusy(true);
    setError("");
    try {
      await saveBulkTransferSettings(next);
      await onSaved();
      toast.success("Bulk transfer settings saved");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save bulk transfer settings."); }
    finally { setBusy(false); }
  };

  return (
    <Card className="space-y-4 rounded-2xl p-4 sm:p-5">
      <div><h2 className="text-lg font-semibold">Bulk pricing and limits</h2><p className="text-sm text-muted-foreground">Fees apply per recipient. VAT applies to the fee. Bulk batches use their own pricing.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><Label htmlFor="bulk-enabled">Accept new bulk transfers</Label><Switch id="bulk-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={busy} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([name, label, step, min, max]) => <div key={name} className="space-y-1.5">
            <Label htmlFor={`bulk-${name}`}>{label}</Label>
            <Input id={`bulk-${name}`} name={name} type="number" required defaultValue={settings[name]} min={min} max={max} step={step} disabled={busy} />
          </div>)}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save bulk transfer settings"}</Button>
      </form>
    </Card>
  );
}

export function AdminBulkTransfers() {
  const { user } = useSupabaseUser();
  const [selected, setSelected] = useState<string>();
  const [before, setBefore] = useState<string>();
  const [checking, setChecking] = useState(false);
  const key = ["workspace", user?.id, "admin-bulk"] as const;
  const settings = useQuery({ queryKey: [...key, "settings"], queryFn: getBulkTransferSettings });
  const history = useQuery({ queryKey: [...key, "history", before], queryFn: () => getBulkTransferHistory(true, before) });
  const details = useQuery({ queryKey: [...key, "detail", selected], queryFn: () => getBulkTransferBatch(selected!, true), enabled: Boolean(selected) });
  const batch = details.data;

  const refreshProvider = async () => {
    if (!selected || checking) return;
    setChecking(true);
    try {
      await runBulkTransfer({ action: "reconcile", batch_id: selected });
      await Promise.allSettled([details.refetch(), history.refetch()]);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn’t refresh the batch."); }
    finally { setChecking(false); }
  };

  const page = history.data ?? [];
  return (
    <div className="space-y-4">
      {settings.data ? <BulkPricing key={JSON.stringify(settings.data)} settings={settings.data} onSaved={settings.refetch} />
        : settings.isError ? <Button type="button" variant="outline" onClick={() => void settings.refetch()}>Reload pricing and limits</Button>
        : <p role="status">Loading bulk transfer settings…</p>}
      <Card className="space-y-3 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Bulk transfer batches</h2><Button type="button" variant="outline" size="sm" onClick={() => void history.refetch()}>Refresh list</Button></div>
        {history.isPending && <p role="status">Loading batches…</p>}
        {history.isError && <p role="alert" className="text-sm text-destructive">Couldn’t load the batch list.</p>}
        {history.isSuccess && !page.length && <p className="text-sm text-muted-foreground">No authorized batches on this page.</p>}
        <ul className="divide-y">{page.map((row) => (
          <li key={row.id}><button type="button" aria-pressed={selected === row.id} onClick={() => setSelected(row.id)} disabled={checking}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            <span className="min-w-0 break-words text-sm font-semibold">{row.title}<span className="block text-xs font-normal text-muted-foreground">{row.owner_name || row.user_id} · {row.recipient_count} recipients · {bulkStatus(row.status)}</span></span>
            <span className="text-sm font-semibold tabular-nums">{bulkMoney(row.total)}</span>
          </button></li>
        ))}</ul>
        <div className="flex flex-wrap gap-2">
          {before && <Button type="button" variant="outline" size="sm" onClick={() => setBefore(undefined)}>Newest batches</Button>}
          {page.length === 25 && <Button type="button" variant="outline" size="sm" onClick={() => setBefore(page[24].authorized_at ?? undefined)}>Older batches</Button>}
        </div>
      </Card>
      {selected && details.isPending && <p role="status">Loading batch details…</p>}
      {selected && details.isError && <Button type="button" variant="outline" onClick={() => void details.refetch()}>Reload batch details</Button>}
      {batch && <>
        <BulkTransferDetails batch={batch} showReferences />
        <Card className="space-y-3 rounded-2xl p-4 text-sm">
          <p>Batch ID <span className="break-all font-mono">{batch.id}</span></p>
          <p>Flutterwave batch <span className="font-mono">{batch.provider_batch_id ?? "Awaiting reference"}</span></p>
          <p className="tabular-nums">Settled {bulkMoney(batch.settled_principal)} · Fees {bulkMoney(batch.settled_fee)} · VAT {bulkMoney(batch.settled_vat)}</p>
          {!!batch.pending && <Button type="button" variant="outline" onClick={() => void refreshProvider()} disabled={checking}>{checking ? "Checking…" : "Check provider status"}</Button>}
        </Card>
      </>}
    </div>
  );
}
