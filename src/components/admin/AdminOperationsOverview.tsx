import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Clock3, Gavel, Inbox, LifeBuoy, RefreshCw, ShieldAlert, ShieldCheck, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FlipCounterHero } from "@/components/admin/FlipCounterHero";
import { naira } from "@/services/supabase/pricingService";

type Overview = {
  payout_health: { worker_stale: boolean; stalled_payouts: number } | null;
  wallet_approvals: number;
  payout_approvals: number;
  incoming_review: number;
  legacy_card_review: number;
  support_work: number;
  platform?: {
    users: number;
    verified_bvn: number;
    restricted_users: number;
    wallet_float: number;
    groups: number;
    group_liquidity: number;
    aml_alerts: number;
    high_aml_alerts: number;
    outside_payments: number;
  };
  governance: { open_votes: number; overdue_votes: number; approved_unsettled: number };
  admins: { id: string; name: string | null; status: string; pin_ready: boolean }[];
};

export type AdminOperationsDestination = "users" | "gateway" | "governance" | "support";

export function AdminOperationsOverview({ adminId, onOpen }: {
  adminId: string;
  onOpen: (tab: AdminOperationsDestination) => void;
}) {
  const overview = useQuery({
    queryKey: ["admin-operations-overview", adminId],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_operations_overview").abortSignal(signal);
      if (error) throw error;
      return data as unknown as Overview;
    },
    refetchInterval: 60_000,
  });
  const data = overview.data;
  const totals = data?.platform;
  const metrics = totals ? [
    { label: "Platform users", value: totals.users.toLocaleString("en-NG"), detail: `${totals.verified_bvn} BVN verified · ${totals.restricted_users} restricted`, icon: Users },
    { label: "Group liquidity", value: naira.format(totals.group_liquidity), detail: `${totals.groups} ${totals.groups === 1 ? "group" : "groups"}`, icon: Building2 },
    { label: "Wallet float", value: naira.format(totals.wallet_float), icon: Wallet },
    { label: "Open AML alerts", value: totals.aml_alerts.toLocaleString("en-NG"), detail: `${totals.high_aml_alerts} high or critical`, icon: ShieldAlert },
  ] : [];
  const activeAdmins = data?.admins.filter(admin => admin.status === "active") ?? [];
  const ready = activeAdmins.filter(admin => admin.pin_ready).length;
  const work = data ? [
    { label: "Wallet debit approvals", value: data.wallet_approvals, detail: "Debit requests awaiting a decision", tab: "users", icon: Wallet },
    { label: "Payout approvals", value: data.payout_approvals, detail: "Recoveries awaiting a decision", tab: "gateway", icon: ShieldCheck },
    { label: "Incoming payments", value: data.incoming_review, detail: data.legacy_card_review ? data.legacy_card_review + " awaiting manual card review" : "Waiting for account matching or settlement", tab: "gateway", icon: Inbox },
    { label: "Delayed bank payouts", value: data.payout_health?.stalled_payouts ?? null, detail: data.payout_health?.worker_stale ? "Reconciliation worker is overdue" : "Dispatched and pending over five minutes", tab: "gateway", icon: Clock3 },
    { label: "Group governance exceptions", value: data.governance.overdue_votes + data.governance.approved_unsettled, detail: data.governance.overdue_votes + " overdue · " + data.governance.approved_unsettled + " awaiting settlement · " + data.governance.open_votes + " open votes", tab: "governance", icon: Gavel },
    { label: "Support tickets", value: data.support_work, detail: "Open or in review", tab: "support", icon: LifeBuoy },
  ] as const : [];

  return (
    <div className="space-y-5">
      {totals && <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Platform totals">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="cp-card-native min-w-0 rounded-xl p-3 sm:p-4">
            <dt className="flex items-start justify-between gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
              {label}<Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </dt>
            <dd className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</dd>
            {detail && <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>}
          </div>
        ))}
      </dl>}
      {data && !totals && <p className="text-sm text-muted-foreground">Platform totals are unavailable.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Work queues</h2>
        <Button variant="outline" size="sm" disabled={overview.isFetching} onClick={() => void overview.refetch()}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Refresh queues
        </Button>
      </div>
      {overview.isPending && <p className="text-sm text-muted-foreground" role="status">Loading operations…</p>}
      {overview.isError && <p className="text-sm text-destructive" role="status">{data ? "Refresh failed. Showing the last available snapshot." : "Couldn’t load operations. Refresh to retry."}</p>}
      {data && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {work.map(({ label, value, detail, tab, icon: Icon }) => (
            <button key={label} type="button" onClick={() => onOpen(tab)}
              className="cp-card-native min-w-0 space-y-2 p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </span>
              <strong className="block text-2xl font-semibold tabular-nums">{value === null ? "Unavailable" : value.toLocaleString("en-NG")}</strong>
              <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
            </button>
          ))}
        </div>
        <section className="cp-card-native space-y-3 p-4 sm:p-5" aria-labelledby="admin-readiness">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 id="admin-readiness" className="font-semibold">Administrator readiness</h2>
              <p className="text-sm text-muted-foreground">{ready} of {activeAdmins.length} active administrators have a transaction PIN.</p>
              {ready < 2 && <p className="text-sm text-amber-700 dark:text-amber-300">Two active administrators with PINs are required for independent approvals.</p>}
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/settings">Manage my PIN</Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {data.admins.map(admin => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="break-words">{admin.name || "Administrator"}{admin.id === adminId ? " (you)" : ""}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="capitalize">{admin.status}</Badge>
                  <Badge variant={admin.pin_ready ? "secondary" : "outline"}>{admin.pin_ready ? "PIN set" : "PIN needed"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {totals && <details className="cp-card-native rounded-xl p-4">
          <summary className="cursor-pointer rounded-sm text-sm font-semibold">Live signup display</summary>
          <div className="mt-4">
            <FlipCounterHero userCount={totals.users} bvnVerifiedCount={totals.verified_bvn} groupCount={totals.groups}
              totalLiquidity={totals.group_liquidity} externalPaymentsCount={totals.outside_payments} />
          </div>
        </details>}
      </>}
    </div>
  );
}
