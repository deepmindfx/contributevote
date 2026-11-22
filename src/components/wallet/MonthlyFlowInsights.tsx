import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentLagosMonth, loadGroupMonth } from "@/services/supabase/monthlyLedger";
import type { MonthlyFlows } from "@/services/supabase/monthlyLedger";
import { naira } from "@/services/supabase/pricingService";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <Input className="h-11 w-full min-w-0 sm:w-auto" type="month" aria-label="Statement month" value={month} max={currentLagosMonth()}
      onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) onChange(event.target.value); }} />
  );
}

export function MonthlyFlowInsights({ report, group = false }: { report: MonthlyFlows; group?: boolean }) {
  const max = Math.max(1, ...report.daily.flatMap(({ incoming, outgoing }) => [incoming, outgoing]));
  const amounts = [
    ["Money in", report.incoming, ArrowDownLeft],
    ["Money out", report.outgoing, ArrowUpRight],
    ["Net movement", report.incoming - report.outgoing, Activity],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {amounts.map(([name, amount, Icon]) => (
          <div key={name} className="min-w-0 rounded-xl border bg-accent/45 p-3">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon size={14} aria-hidden />{name}</p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums">{naira.format(amount)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-3">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
          <p className="font-semibold">Movement by day</p><p className="text-xs text-muted-foreground">Green is in · Amber is out</p>
        </div>
        <div className="flex h-20 items-end gap-px" role="img" aria-label="Daily money in and out chart for the selected month">
          {report.daily.map(({ day, incoming, outgoing }) => (
            <div key={day} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`Day ${day} · In ${naira.format(incoming)} · Out ${naira.format(outgoing)}`}>
              <div className="w-1/2 rounded-t-sm bg-emerald-500" style={{ height: `${incoming / max * 100}%` }} />
              <div className="w-1/2 rounded-t-sm bg-amber-500" style={{ height: `${outgoing / max * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between border-t pt-1 text-xs text-muted-foreground"><span>Day 1</span><span>Day {report.daily.length}</span></div>
      </div>
      <dl className="wallet-value-rows rounded-xl border px-3 text-sm">
        <div><dt>{group ? "Outside bank transfers" : "Completed bank transfers"}</dt><dd>{report.bankTransfers} · {naira.format(report.bankTotal)}</dd></div>
        <div><dt>Average bank transfer</dt><dd>{naira.format(report.bankTransfers ? report.bankTotal / report.bankTransfers : 0)}</dd></div>
        <div><dt>Platform fees paid</dt><dd>{naira.format(report.fees)}</dd></div>
        <div><dt>Pending / Failed</dt><dd>{report.pending} / {report.failed}</dd></div>
      </dl>
      {report.breakdown.length > 0 && (
        <ul className="divide-y rounded-xl border px-3 text-sm" aria-label="Transactions by type">
          {report.breakdown.map(({ label, amount, count }) => (
            <li key={label} className="flex flex-wrap justify-between gap-2 py-2.5">
              <span>{label} <span className="text-muted-foreground">({count})</span></span>
              <strong className="tabular-nums">{naira.format(amount)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GroupTransferAnalytics({ groupId }: { groupId: string }) {
  const { user } = useSupabaseUser();
  const [month, setMonth] = useState(currentLagosMonth);
  const analytics = useQuery({
    queryKey: ["workspace", user?.id, "group-analytics", groupId, month],
    queryFn: ({ signal }) => loadGroupMonth(groupId, month, signal),
    enabled: Boolean(user?.id),
    staleTime: 20_000,
    retry: false,
  });

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Group transfer analytics">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Group transfer analytics</h2><MonthPicker month={month} onChange={setMonth} /></div>
      {analytics.data ? <MonthlyFlowInsights report={analytics.data} group /> : analytics.isError ? (
        <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-sm">Couldn’t load analytics.</p><Button variant="outline" onClick={() => void analytics.refetch()}>Retry</Button></div>
      ) : <p role="status" className="text-sm text-muted-foreground">Loading group activity…</p>}
    </section>
  );
}
