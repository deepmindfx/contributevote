import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

type PayoutHealth = {
  last_finished_at: string | null;
  worker_stale: boolean;
  stalled_payouts: number;
  stalled_bulk_payouts: number;
  oldest_dispatched_at: string | null;
  last_run: { single?: { failed: number }; bulk?: { failed: number } };
};

const time = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export function AdminPayoutHealth() {
  const { user } = useSupabaseUser();
  const health = useQuery({
    queryKey: ["admin-payout-health", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_get_payout_reconciliation_health").abortSignal(signal);
      if (error || !data) throw new Error("Payout health is unavailable");
      return data as unknown as PayoutHealth;
    },
  });
  const snapshot = health.data;
  const failures = (snapshot?.last_run.single?.failed ?? 0) + (snapshot?.last_run.bulk?.failed ?? 0);
  const review = snapshot && (snapshot.worker_stale || snapshot.stalled_payouts > 0 || failures > 0);
  return (
    <section className="cp-card-native min-w-0 space-y-3 p-4 sm:p-5" aria-label="Payout reconciliation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Activity size={17} className="text-primary" /> Payout reconciliation</h3>
        {snapshot && <span className={review ? "text-sm font-medium text-amber-700 dark:text-amber-300" : "text-sm font-medium text-primary"}>
          {review ? "Needs attention" : "Checks running"}
        </span>}
      </div>
      {health.isPending && <p className="text-sm text-muted-foreground">Loading payout checks…</p>}
      {health.isError && <p role="status" className="flex gap-2 text-sm text-muted-foreground"><AlertCircle size={16} /> Couldn’t refresh payout checks.</p>}
      {snapshot && <>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Last completed check</dt><dd className="font-medium">{snapshot.last_finished_at ? time.format(new Date(snapshot.last_finished_at)) : "Awaiting first check"}</dd></div>
          <div><dt className="text-muted-foreground">Pending over 5 minutes</dt><dd className="font-medium">{snapshot.stalled_payouts} · {snapshot.stalled_bulk_payouts} in bulk batches</dd></div>
          <div><dt className="text-muted-foreground">Errors in last check</dt><dd className="font-medium">{failures}</dd></div>
        </dl>
        {snapshot.oldest_dispatched_at && <p className="text-xs text-muted-foreground">Oldest pending payout was created {time.format(new Date(snapshot.oldest_dispatched_at))}.</p>}
      </>}
    </section>
  );
}
