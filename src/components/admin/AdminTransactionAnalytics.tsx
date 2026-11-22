import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentLagosMonth, lagosMonthRange } from "@/services/supabase/monthlyLedger";
import { getGroupWithdrawalPolicy, naira, setGroupWithdrawalOverride } from "@/services/supabase/pricingService";

type Scope = "platform" | "account" | "group";
type Entity = { id: string; name: string; description: string | null };
type Volume = {
  transactions: number; settled: number; pending: number; failed: number; volume: number; unreconciled: number;
  daily: { day: string; count: number; amount: number }[];
  breakdown: { type: string; count: number; amount: number }[];
};
const labels: Record<string, string> = {
  deposit: "Deposits", transfer: "Bank transfers", contribution: "Contributions",
  withdrawal: "Withdrawals", refund: "Refunds", payment: "Payments",
};

function GroupFeeOverride({ group }: { group: Entity }) {
  const client = useQueryClient();
  const queryKey = ["group-withdrawal-policy", group.id];
  const query = useQuery({ queryKey, queryFn: () => getGroupWithdrawalPolicy(group.id) });
  const save = useMutation({
    mutationFn: (enabled: boolean | null) => setGroupWithdrawalOverride(group.id, enabled),
    async onSuccess() {
      await client.invalidateQueries({ queryKey });
      toast.success("Group fee preference saved.");
    },
    onError(error) { toast.error(error.message); },
  });

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <Label htmlFor="admin-group-fee">Withdrawal fee for {group.name}</Label>
      {group.description?.toLowerCase() === "charity" ? <p className="text-sm text-muted-foreground">Charity groups are exempt.</p> : (
        <>
          <select id="admin-group-fee" className="h-10 w-full rounded-md border bg-background px-2 text-sm sm:max-w-xs"
            disabled={!query.data || save.isPending} value={query.data?.override == null ? "default" : String(query.data.override)}
            onChange={(event) => save.mutate(event.target.value === "default" ? null : event.target.value === "true")}>
            <option value="default">Use platform default</option>
            <option value="true">Charge the configured rate</option>
            <option value="false">Waive the fee</option>
          </select>
          {query.data && <p className="text-xs text-muted-foreground">Current rate {query.data.percent}%.</p>}
          {query.isError && <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry fee lookup</Button>}
        </>
      )}
    </div>
  );
}

export function AdminTransactionAnalytics() {
  const [month, setMonth] = useState(currentLagosMonth);
  const [scope, setScope] = useState<Scope>("platform");
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<Entity>();
  const queryText = useDeferredValue(search.trim());
  const { start, end, days } = lagosMonthRange(month);

  const entities = useQuery({
    queryKey: ["admin-transaction-entities", scope, queryText],
    enabled: scope !== "platform",
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_search_transaction_entities", { p_scope: scope, p_search: queryText }).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const analytics = useQuery({
    queryKey: ["admin-transaction-analytics", month, scope, entity?.id],
    enabled: scope === "platform" || Boolean(entity),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_transaction_analytics", {
        p_start: start, p_end: end, p_scope: scope, p_entity_id: entity?.id,
      }).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data as unknown as Volume;
    },
  });
  const result = analytics.data;
  const max = Math.max(1, ...(result?.daily.map((day) => day.amount) ?? []));
  const buckets = new Map(result?.daily.map((day) => [Number(day.day.slice(-2)), day]));

  return (
    <div className="space-y-4">
      <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 size={20} aria-hidden="true" className="text-primary" /> Transaction analytics</h2>
            <p className="text-sm text-muted-foreground">NGN volume and transaction status by month.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="volume-scope">Scope</Label>
              <select id="volume-scope" value={scope} className="block h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => {
                setScope(event.target.value as Scope); setEntity(undefined); setSearch("");
              }}>
                <option value="platform">Entire platform</option><option value="account">Account</option><option value="group">Group</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="volume-month">Month</Label>
              <Input id="volume-month" type="month" value={month} max={currentLagosMonth()} onChange={(event) => {
                if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value);
              }} />
            </div>
          </div>
        </div>
        {scope !== "platform" && (
          <div className="space-y-2">
            <Label htmlFor="volume-search" className="flex items-center gap-1.5"><Search size={14} aria-hidden="true" /> Find an {scope === "account" ? "account" : "individual group"}</Label>
            <Input id="volume-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={120}
              placeholder={scope === "account" ? "Name, email or account ID" : "Group name or ID"} />
            {entities.isError && <Button type="button" variant="outline" size="sm" onClick={() => void entities.refetch()}>Retry search</Button>}
            {entities.isFetching && <p role="status" className="text-xs text-muted-foreground">Searching…</p>}
            {entities.data?.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
            {!!entities.data?.length && (
              <ul className="max-h-40 divide-y overflow-auto rounded-lg border">
                {entities.data.map((item) => <li key={item.id}>
                  <button type="button" aria-pressed={entity?.id === item.id} onClick={() => setEntity(item)}
                    className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 break-all px-3 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-accent">
                    <span className="font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.description}</span>
                  </button>
                </li>)}
              </ul>
            )}
          </div>
        )}
        {entity && scope === "group" && <GroupFeeOverride key={entity.id} group={entity} />}
      </Card>

      {analytics.isFetching && <p role="status" className="text-sm text-muted-foreground">Loading transaction volume…</p>}
      {analytics.isError && <Button type="button" variant="outline" onClick={() => void analytics.refetch()}>Retry analytics</Button>}
      {result && (
        <>
          <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
            <h3 className="text-base font-semibold">{entity?.name || "Platform totals"}</h3>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Settled volume", naira.format(result.volume)],
                ["Settled transactions", result.settled.toLocaleString()],
                ["Pending", result.pending.toLocaleString()],
                ["Failed or cancelled", result.failed.toLocaleString()],
              ].map(([label, value]) => <div key={label} className="rounded-xl border bg-muted/35 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd>
              </div>)}
            </dl>
            <p className="text-xs text-muted-foreground">{result.transactions.toLocaleString()} ledger entries in the selected month. Volume sums settled amounts across payment categories.</p>
            {result.unreconciled > 0 && <p className="rounded-lg bg-amber-500/10 p-2 text-sm">{result.unreconciled} bank transfers have been pending for over 30 minutes.</p>}
            <div role="img" aria-label="Daily settled transaction volume" className="flex h-28 items-end gap-px border-b sm:gap-1">
              {Array.from({ length: days }, (_, index) => {
                const value = buckets.get(index + 1)?.amount ?? 0;
                return <div key={index} title={"Day " + (index + 1) + " · " + naira.format(value)} className="min-w-0 flex-1 rounded-t-sm bg-primary/75"
                  style={{ height: value > 0 ? Math.max(3, value / max * 100) + "%" : "1px" }} />;
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Day 1</span><span>Day {days}</span></div>
          </Card>
          <Card className="space-y-3 rounded-2xl p-4 sm:p-6">
            <h3 className="text-base font-semibold">Settled by transaction type</h3>
            {result.breakdown.length ? <ul className="divide-y">
              {result.breakdown.map((row) => <li key={row.type} className="flex flex-wrap items-center justify-between gap-x-3 py-2 text-sm">
                <span>{labels[row.type] || row.type} <span className="text-muted-foreground">· {row.count.toLocaleString()}</span></span>
                <strong className="tabular-nums">{naira.format(row.amount)}</strong>
              </li>)}
            </ul> : <p className="text-sm text-muted-foreground">No settled transactions this month.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
