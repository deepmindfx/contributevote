import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, BadgeCheck, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBankDirectory } from "@/hooks/useBankDirectory";
import { cn } from "@/lib/utils";
import type { BulkTransferBatch } from "@/services/supabase/bulkTransferService";
import { supportLink } from "@/services/supabase/supportService";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
export const bulkMoney = (amount: number) => naira.format(amount);

const labels: Record<BulkTransferBatch["status"], string> = {
  quoted: "Awaiting approval", expired: "Quote expired", reserved: "Authorized", processing: "Processing",
  partial: "Partially completed", completed: "Completed", failed: "Failed", needs_review: "Awaiting provider confirmation",
};
export const bulkStatus = (status: BulkTransferBatch["status"]) => labels[status];

export function BulkTransferDetails({ batch, showReferences = false, actions }: {
  batch: BulkTransferBatch;
  showReferences?: boolean;
  actions?: ReactNode;
}) {
  const { data: banks } = useBankDirectory(Boolean(batch.recipients?.length));
  const bankNames = new Map(banks?.map((bank) => [bank.code, bank.name]));
  const costRows = [
    { label: "Recipient amounts", amount: batch.principal },
    { label: "Transfer fees", amount: batch.fee },
    { label: `VAT on fees (${batch.vat_percent}%)`, amount: batch.vat },
  ];

  return (
    <Card className="min-w-0 overflow-hidden rounded-3xl">
      <div className="space-y-4 border-b bg-gradient-to-br from-accent/80 to-accent/15 p-4 sm:p-6">
        <div className="flex flex-wrap justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet size={18} aria-hidden="true" /></span>
            <h2 className="min-w-0 break-words pt-1 text-lg font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">{batch.title}</h2>
          </div>
          <span role="status" className="self-start rounded-full border bg-card px-3 py-1 text-xs font-medium">{bulkStatus(batch.status)}</span>
        </div>
        <dl className="space-y-3 text-sm tabular-nums">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{batch.authorized_at ? "Total authorized" : "Total wallet debit"}</dt>
            <dd className="mt-0.5 text-3xl font-semibold tracking-tight sm:text-4xl">{bulkMoney(batch.total)}</dd>
          </div>
          <div className="grid gap-1.5 border-t pt-3">
            {costRows.map(({ label, amount }) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{bulkMoney(amount)}</dd>
              </div>
            ))}
          </div>
        </dl>
      </div>
      <div className="space-y-4 p-4 sm:p-6">
        {batch.authorized_at && (
          <dl className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-2 text-center tabular-nums">
            {[["Completed", batch.completed], ["Pending", batch.pending], ["Failed", batch.failed]].map(([label, count]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold">{count}</dd>
              </div>
            ))}
          </dl>
        )}
        {batch.refunded_total > 0 && (
          <p className="flex items-start gap-2 rounded-xl border bg-accent/50 p-3 text-sm font-medium">
            <ArrowDownLeft size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> {bulkMoney(batch.refunded_total)} returned to the sender’s wallet
          </p>
        )}
        {batch.recipients && <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck size={17} className="text-primary" aria-hidden="true" /> Verified recipients <span className="text-xs font-normal text-muted-foreground">({batch.recipient_count})</span></h3>
          <ul className="max-h-[24rem] divide-y overflow-y-auto rounded-xl border px-3 sm:px-4" aria-label="Recipients">
            {batch.recipients.map((row) => (
              <li key={row.reference} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                  <p className="text-sm font-semibold leading-snug">{row.beneficiary_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{bankNames.get(row.account_bank) ?? `Bank ${row.account_bank}`} · Account {row.account_number}</p>
                  {row.narration && <p className="text-xs text-muted-foreground">{row.narration}</p>}
                  {row.message && <p className="text-xs text-muted-foreground">{row.message}</p>}
                  {showReferences && <p className="break-all font-mono text-xs text-muted-foreground">{row.reference}</p>}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs tabular-nums sm:grid sm:text-right">
                  <strong className="text-sm font-semibold">{bulkMoney(row.amount)}</strong>
                  <span className="text-muted-foreground">Fee {bulkMoney(row.fee)} · VAT {bulkMoney(row.vat)}</span>
                  {batch.authorized_at && <span className={cn("font-medium capitalize", row.status === "completed" && "text-primary", row.status === "failed" && "text-destructive")}>{row.status}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>}
        {batch.status === "needs_review" && <p className="text-sm text-muted-foreground">Some payouts are awaiting bank confirmation. We’ll continue checking automatically. Check this batch before paying those recipients again.</p>}
        {batch.authorized_at && !showReferences && <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={supportLink("bulk_transfer", batch.id)}>Get help with this batch</Link>}
      </div>
      {actions && <div className="space-y-2 border-t bg-muted/25 px-4 py-3 sm:px-6">{actions}</div>}
    </Card>
  );
}
