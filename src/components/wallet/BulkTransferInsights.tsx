import { ArrowDownLeft, ArrowUpRight, Clock3, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { bulkMoney } from "@/components/wallet/BulkTransferDetails";
import type { BulkTransferAnalytics } from "@/services/supabase/bulkTransferService";

const outcomes = [
  { name: "Paid", color: "bg-emerald-500" },
  { name: "Pending", color: "bg-amber-500" },
  { name: "Failed", color: "bg-rose-500" },
] as const;

export function BulkTransferInsights({ report }: { report: BulkTransferAnalytics }) {
  const { totals, daily, banks } = report;
  const change = Math.round((totals.paid_principal - totals.previous_paid_principal) * 100) / 100;
  const comparison = totals.previous_paid_principal === 0
    ? "No paid payouts in the previous month"
    : change === 0 ? "Same as the previous month"
    : `${change > 0 ? "+" : "−"}${bulkMoney(Math.abs(change))} vs. previous month`;
  const completion = totals.recipients ? totals.completed / totals.recipients : 0;
  const percent = new Intl.NumberFormat("en-NG", { style: "percent", maximumFractionDigits: 1 }).format(completion);
  const activeDays = daily.filter(({ paid, pending, failed }) => paid + pending + failed > 0);
  const largestDay = Math.max(1, ...activeDays.map(({ paid, pending, failed }) => paid + pending + failed));
  const amounts = [
    ["Paid to recipients", totals.paid_principal, ArrowUpRight],
    ["Authorized from wallet", totals.authorized_total, Wallet],
    ["Still reserved", totals.pending_total, Clock3],
    ["Returned to wallet", totals.refunded_total, ArrowDownLeft],
  ] as const;
  const counts = [totals.completed, totals.pending, totals.failed];

  if (!totals.batches) return <Card className="rounded-2xl p-4 text-sm text-muted-foreground">No bulk transfers were authorized this month.</Card>;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:gap-3" aria-label="Monthly bulk transfer totals">
        {amounts.map(([name, amount, Icon], index) => (
          <Card key={name} className={`min-w-0 rounded-2xl p-3.5 sm:p-4 ${index === 0 ? "border-primary/30 bg-accent/70" : ""}`}>
            <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground"><Icon size={15} className="shrink-0 text-primary" aria-hidden="true" />{name}</p>
            <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{bulkMoney(amount)}</p>
            {index === 0 && <p className="mt-0.5 text-xs text-muted-foreground">{comparison}</p>}
          </Card>
        ))}
      </section>

      <Card className="space-y-3 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h2 className="font-semibold">Payout outcomes</h2>
          <span className="text-sm font-semibold tabular-nums">{percent} completed</span>
        </div>
        <p className="text-sm text-muted-foreground">{totals.recipients} payouts across {totals.batches} {totals.batches === 1 ? "batch" : "batches"}</p>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {outcomes.map(({ name, color }, index) => (
            <div key={name} className={color} style={{ width: `${counts[index] / Math.max(1, totals.recipients) * 100}%` }} />
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          {outcomes.map(({ name, color }, index) => (
            <div key={name} className="flex flex-wrap items-center gap-1.5">
              <dt className="flex items-center gap-1"><span className={`size-2 rounded-full ${color}`} aria-hidden="true" />{name}</dt>
              <dd className="font-semibold tabular-nums">{counts[index]}</dd>
            </div>
          ))}
        </dl>
        <dl className="wallet-value-rows border-t text-sm">
          <div><dt>Average paid payout</dt><dd>{bulkMoney(totals.completed ? totals.paid_principal / totals.completed : 0)}</dd></div>
          <div><dt>Transfer fees paid</dt><dd>{bulkMoney(totals.paid_fee)}</dd></div>
          <div><dt>VAT paid on fees</dt><dd>{bulkMoney(totals.paid_vat)}</dd></div>
        </dl>
      </Card>

      <Card className="space-y-3 rounded-2xl p-4 sm:p-5">
        <h2 className="font-semibold">Payouts by authorization day</h2>
        <div role="img" aria-label="Daily principal amounts by payout outcome. Exact amounts are listed below."
          className="flex h-28 items-end gap-px border-b sm:gap-1">
          {daily.map(({ day, paid, pending, failed }) => (
            <div key={day} className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`Day ${day} · Paid ${bulkMoney(paid)} · Pending ${bulkMoney(pending)} · Failed ${bulkMoney(failed)}`}>
              {[failed, pending, paid].map((amount, index) => (
                <div key={outcomes[2 - index].name} className={outcomes[2 - index].color} style={{ height: `${amount / largestDay * 100}%` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Day 1</span><span>Day {daily.length}</span></div>
        <details className="rounded-xl border px-3">
          <summary className="cursor-pointer py-2.5 text-sm font-medium">See daily amounts</summary>
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-left text-xs tabular-nums">
              <thead><tr className="text-muted-foreground"><th scope="col">Day</th><th scope="col">Paid</th><th scope="col">Pending</th><th scope="col">Failed</th></tr></thead>
              <tbody className="divide-y">{activeDays.map(({ day, paid, pending, failed }) => (
                <tr key={day}><th scope="row" className="py-2 pr-2">{day}</th><td className="pr-2">{bulkMoney(paid)}</td><td className="pr-2">{bulkMoney(pending)}</td><td>{bulkMoney(failed)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      </Card>

      {banks.length > 0 && <Card className="rounded-2xl p-4 sm:p-5">
        <h2 className="mb-2 font-semibold">Payouts by bank</h2>
        <ul className="divide-y">
          {banks.map((bank) => (
            <li key={bank.bank_code ?? "other"} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{bank.bank_name ?? (bank.bank_code ? `Bank ${bank.bank_code}` : "Other banks")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{bank.completed} paid · {bank.pending} pending · {bank.failed} failed</p>
              </div>
              <strong className="text-sm tabular-nums">{bulkMoney(bank.paid_principal)} <small className="font-normal text-muted-foreground">paid</small></strong>
            </li>
          ))}
        </ul>
      </Card>}
    </div>
  );
}
