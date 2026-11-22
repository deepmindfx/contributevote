import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getIceVaultReport, saveIceVaultSettings, savingsPeriods, type IceVaultSettings } from "@/services/supabase/fixedSavingsService";
import { naira } from "@/services/supabase/pricingService";

const timestamp = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const limitFields = [
  ["min_amount", "Minimum per lock (₦)"],
  ["max_amount", "Maximum per lock (₦)"],
  ["max_wallet_locked", "Maximum held per wallet (₦)"],
  ["max_active_locks", "Open locks per wallet"],
] as const;

function IceVaultSettingsForm({ settings, onSaved }: { settings: IceVaultSettings; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [days, setDays] = useState(settings.allowed_days);
  const [termsVersion, setTermsVersion] = useState(settings.terms_version || "");
  const [termsUrl, setTermsUrl] = useState(settings.terms_url || "");
  const [limits, setLimits] = useState({
    min_amount: String(settings.min_amount), max_amount: String(settings.max_amount),
    max_wallet_locked: String(settings.max_wallet_locked), max_active_locks: String(settings.max_active_locks),
  });
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !days.length) return;
    submitting.current = true;
    setSaving(true);
    try {
      await saveIceVaultSettings({
        revision: settings.revision, enabled, allowed_days: days,
        min_amount: Number(limits.min_amount), max_amount: Number(limits.max_amount),
        max_wallet_locked: Number(limits.max_wallet_locked), max_active_locks: Number(limits.max_active_locks),
        terms_version: termsVersion.trim(), terms_url: termsUrl.trim(),
      });
      toast.success("Ice Vault settings saved.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save Ice Vault settings.");
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  };

  return (
    <Card className="rounded-2xl p-4 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Lock settings</h2>
      <form className="space-y-4" onSubmit={save}>
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div><Label htmlFor="ice-vault-intake">Accept new locks</Label><p className="text-xs text-muted-foreground">Existing locks still mature when intake pauses.</p></div>
          <Switch id="ice-vault-intake" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {limitFields.map(([key, label]) => <div key={key} className="space-y-1.5">
            <Label htmlFor={"ice-vault-" + key}>{label}</Label>
            <Input id={"ice-vault-" + key} type="number" min={1} max={key === "max_active_locks" ? 100 : 999999999999.99}
              step={key === "max_active_locks" ? 1 : "0.01"} required value={limits[key]}
              onChange={(event) => setLimits((previous) => ({ ...previous, [key]: event.target.value }))} />
          </div>)}
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Available lock periods</legend>
          <div className="flex flex-wrap gap-3">
            {savingsPeriods.map((term) => <label key={term} className="inline-flex min-h-10 items-center gap-1.5 text-sm">
              <input type="checkbox" className="accent-primary" checked={days.includes(term)}
                onChange={(event) => setDays((previous) => event.target.checked ? [...previous, term] : previous.filter((day) => day !== term))} /> {term} days
            </label>)}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="ice-vault-terms-version">Terms version</Label>
          <Input id="ice-vault-terms-version" autoComplete="off" maxLength={80} value={termsVersion} required={enabled || Boolean(termsUrl)} onChange={(event) => setTermsVersion(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ice-vault-terms-url">Ice Vault terms URL</Label>
          <Input id="ice-vault-terms-url" type="url" maxLength={2048} value={termsUrl} required={enabled || Boolean(termsVersion)} onChange={(event) => setTermsUrl(event.target.value)} />
          <p className="text-xs text-muted-foreground">Use a new version for each change to the published terms.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={saving || !days.length}>{saving ? "Saving…" : "Save settings"}</Button>
      </form>
    </Card>
  );
}

export function AdminIceVault() {
  const { user } = useSupabaseUser();
  const report = useQuery({
    queryKey: ["workspace", user?.id, "ice-vault-admin"],
    queryFn: ({ signal }) => getIceVaultReport(signal),
    enabled: Boolean(user?.id),
  });
  const data = report.data;

  if (!data) return <Card className="space-y-2 p-4">
    <p role="status">{report.isPending ? "Loading Ice Vault…" : "Couldn’t load Ice Vault."}</p>
    {!report.isPending && <Button variant="outline" onClick={() => void report.refetch()}>Retry</Button>}
  </Card>;

  const { settings, totals } = data;
  const cards = [
    ["Currently locked", naira.format(totals.locked)],
    ["Active locks", totals.active_count],
    ["Due in the next 7 days", naira.format(totals.due_next_7d)],
    ["Paid back in the last 30 days", naira.format(totals.released_30d)],
    ...(settings.settlement_mode === "partner_api" || totals.pending > 0 || totals.matured_uncredited > 0 ? [
      ["Awaiting reserve confirmation", naira.format(totals.pending)],
      ["Matured and available to claim", naira.format(totals.matured_uncredited)],
    ] : []),
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Snowflake size={18} aria-hidden="true" /> Ice Vault</h2>
          <Button size="sm" variant="outline" disabled={report.isFetching} onClick={() => void report.refetch()}>Refresh</Button>
        </div>
        <p className="text-sm text-muted-foreground">{settings.ready ? "Taking new locks" : settings.enabled ? "Intake waiting for the settlement worker" : "Intake paused"} · {settings.settlement_mode === "wallet_ledger" ? "Wallet ledger" : "Partner release API"}</p>
        <dl className="grid gap-2 sm:grid-cols-2">{cards.map(([label, value]) => <div key={label} className="rounded-xl border bg-accent/30 p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-lg font-semibold tabular-nums">{value}</dd>
        </div>)}</dl>
        {(totals.overdue_count > 0 || totals.old_pending_count > 0) && <p role="status" className="rounded-xl border border-destructive/30 p-3 text-sm">
          {totals.overdue_count} overdue locks ({naira.format(totals.overdue_amount)}) · {totals.old_pending_count} delayed reservations
        </p>}
        <p className="text-xs text-muted-foreground">
          {settings.scheduler_seen_at ? "Last successful sweep " + timestamp.format(new Date(settings.scheduler_seen_at)) : "Awaiting first maturity sweep"}
        </p>
      </Card>
      <IceVaultSettingsForm key={settings.revision} settings={settings} onSaved={() => void report.refetch()} />
    </div>
  );
}
