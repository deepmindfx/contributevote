import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BulkTransferInsights } from "@/components/wallet/BulkTransferInsights";
import { bulkMoney, bulkStatus } from "@/components/wallet/BulkTransferDetails";
import { MonthPicker } from "@/components/wallet/MonthlyFlowInsights";
import { StatementExportButton } from "@/components/wallet/StatementExportButton";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { currentLagosMonth } from "@/services/supabase/monthlyLedger";
import { loadBulkTransferAnalytics, loadBulkTransferHistory } from "@/services/supabase/bulkTransferService";
import type { BulkHistoryCursor, BulkHistoryStatus } from "@/services/supabase/bulkTransferService";

const statusOptions = [
  ["pending", "Pending"], ["completed", "Completed"], ["partial", "Partially completed"],
  ["failed", "Failed"], ["needs_review", "Needs review"],
] as const satisfies ReadonlyArray<readonly [BulkHistoryStatus, string]>;
const dateFormat = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", month: "short", day: "numeric" });

export default function BulkTransferHistory() {
  const { user } = useSupabaseUser();
  const owner = user?.id;
  const client = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const currentMonth = currentLagosMonth();
  const selectedMonth = search.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth) && selectedMonth <= currentMonth ? selectedMonth : currentMonth;
  const status = statusOptions.find(([value]) => value === search.get("status"))?.[0];
  const view = search.get("view") === "statement" ? "statement" : "analytics";
  const key = ["workspace", owner, "bulk-transfers", "history"] as const;
  const analytics = useQuery({
    queryKey: [...key, "analytics", month],
    queryFn: ({ signal }) => loadBulkTransferAnalytics(month, signal),
    refetchInterval: (query) => query.state.data?.totals.pending ? 20_000 : false,
    staleTime: 15_000,
    enabled: Boolean(owner),
  });
  const batches = useInfiniteQuery({
    queryKey: [...key, "batches", month, status],
    queryFn: ({ pageParam, signal }) => loadBulkTransferHistory(month, status, pageParam, signal),
    initialPageParam: null as BulkHistoryCursor | null,
    getNextPageParam: (page) => {
      const last = page[page.length - 1];
      return page.length === 25 && last.authorized_at ? { before: last.authorized_at, id: last.id } : undefined;
    },
    refetchInterval: analytics.data?.totals.pending ? 20_000 : false,
    staleTime: 15_000,
    enabled: Boolean(owner),
  });

  useEffect(() => {
    if (!owner) return;
    let timer: number | undefined;
    const channel = supabase.channel(`bulk-history-${crypto.randomUUID()}`)
      .on("postgres_changes", { schema: "public", table: "transactions", event: "*", filter: `user_id=eq.${owner}` }, (event) => {
        if (event.eventType === "DELETE" || !event.new.bulk_batch_id) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void client.invalidateQueries({ queryKey: ["workspace", owner, "bulk-transfers", "history"] });
        }, 250);
      }).subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [client, owner]);

  const entries = batches.data?.pages.flat() ?? [];
  const refresh = () => void client.invalidateQueries({ queryKey: key });

  return (
    <WalletFlow title="Bulk transfer history" description="Track payouts, fees, VAT, and refunds by month." wide
      headerRight={<Button asChild variant="outline" size="sm" className="app-panel-secondary gap-1.5"><Link to="/transfer/bulk"><Plus size={16} aria-hidden="true" /> New batch</Link></Button>}>
      <div className="space-y-4">
        <Card className="space-y-3 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{view === "statement" ? "Bulk transfer statement" : "Monthly analytics"}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Refresh bulk transfer history"
              disabled={analytics.isFetching || batches.isFetching} onClick={refresh}>
              <RefreshCw size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <MonthPicker month={month} onChange={(value) => setSearch({ view, month: value, ...(status && { status }) }, { replace: true })} />
            <StatementExportButton month={month} scope="bulk" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Includes batches authorized in the selected month, using Nigeria time. A transaction PIN is required to download.</p>
        </Card>
        {analytics.data ? <BulkTransferInsights report={analytics.data} /> : analytics.isError
          ? <Card className="space-y-3 rounded-2xl p-4"><p role="alert">Couldn’t load analytics.</p><Button type="button" variant="outline" onClick={() => void analytics.refetch()}>Try again</Button></Card>
          : <p role="status" className="text-sm text-muted-foreground">Loading monthly analytics…</p>}

        <Card className="space-y-3 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Batches</h2>
            <div className="space-y-1">
              <Label htmlFor="bulk-history-status" className="text-xs text-muted-foreground">Batch status</Label>
              <select id="bulk-history-status" className="block h-10 max-w-full rounded-xl border bg-background px-2.5 text-sm"
                value={status ?? ""} onChange={(event) => setSearch({ view, month, ...(event.target.value && { status: event.target.value }) }, { replace: true })}>
                <option value="">All statuses</option>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          {batches.isPending && <p role="status" className="text-sm text-muted-foreground">Loading batches…</p>}
          {batches.isError && <div className="space-y-2"><p role="alert" className="text-sm">Couldn’t load {entries.length ? "more batches" : "your batches"}.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void batches.refetch()}>Reload batches</Button></div>}
          {batches.isSuccess && !entries.length && <p className="text-sm text-muted-foreground">No batches match this month and status.</p>}
          {entries.length > 0 && <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/transfer/bulk?${new URLSearchParams({ batch: entry.id, from: "history", month, view, ...(status && { status }) })}`}
                  className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg py-2.5 hover:bg-muted/55 focus-visible:outline-ring">
                  <span className="min-w-28 flex-1 break-words text-sm font-semibold">
                    {entry.title}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {entry.authorized_at && `${dateFormat.format(new Date(entry.authorized_at))} · `}{bulkStatus(entry.status)} · {entry.recipient_count} recipients
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">{bulkMoney(entry.total)}<ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>}
          {batches.hasNextPage && <Button type="button" variant="outline" className="w-full rounded-xl" disabled={batches.isFetching}
            onClick={() => void batches.fetchNextPage()}>{batches.isFetchingNextPage ? "Loading…" : "Load more batches"}</Button>}
        </Card>
      </div>
    </WalletFlow>
  );
}
