import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/services/supabase/pricingService";

const detailByIssue = {
  deadline_passed: "Voting deadline passed. The scheduled check still needs to record the outcome.",
  approval_unverified: "This older request lacks a verified approval.",
  group_unavailable: "The group is unavailable.",
  group_restricted: "Group restrictions are holding settlement.",
  recipient_unavailable: "The withdrawal recipient is unavailable or no longer owns the group.",
  insufficient_balance: "The group balance is below the requested withdrawal.",
  unlinked_contribution: "Group owner must match outside contributions to registered wallets.",
  settlement_pending: "The approved proposal is waiting for settlement.",
};

type Proposal = {
  kind: "withdrawal" | "refund";
  id: string;
  group_id: string | null;
  group_name: string | null;
  description: string;
  status: string | null;
  deadline: string;
  created_at: string;
  amount: number | null;
  fee_amount: number | null;
  refund_percentage: number | null;
  eligible_voters: number | null;
  approval_threshold: number | null;
  votes_for: number | null;
  votes_against: number | null;
  settled_refunds: number | null;
  settled_amount: number | null;
  attention: keyof typeof detailByIssue | null;
};

type Cursor = Pick<Proposal, "created_at" | "id" | "kind">;
const pageSize = 25;
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const time = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const statusLabels: Record<string, string> = {
  pending: "Voting", approved: "Approved", executed: "Settled", rejected: "Rejected", expired: "Expired",
};

export function AdminGroupGovernance({ adminId }: { adminId: string }) {
  const [filter, setFilter] = useState("attention");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pages, setPages] = useState<Cursor[]>([]);
  const cursor = pages[pages.length - 1];
  const proposals = useQuery({
    queryKey: ["admin-governance", adminId, filter, kind, appliedSearch, cursor],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_list_governance_proposals", {
        p_filter: filter,
        p_kind: kind,
        p_search: appliedSearch || undefined,
        p_before_created_at: cursor?.created_at,
        p_before_id: cursor?.id,
        p_before_kind: cursor?.kind,
      }).abortSignal(signal);
      if (error) throw error;
      return data as unknown as Proposal[];
    },
  });
  const rows = proposals.data?.slice(0, pageSize);
  const hasNext = (proposals.data?.length ?? 0) > pageSize;
  const searchProposals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPages([]);
  };
  const next = () => {
    const last = rows?.[rows.length - 1];
    if (!hasNext || !last || proposals.isFetching) return;
    setPages(previous => [...previous, { created_at: last.created_at, id: last.id, kind: last.kind }]);
  };

  return (
    <section className="space-y-4" aria-labelledby="admin-governance-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="admin-governance-title" className="text-lg font-semibold tracking-tight">Proposals</h2>
          <p className="text-sm text-muted-foreground">Track withdrawal and refund votes, settlement holds, and completed refunds.</p>
        </div>
        <Button variant="outline" size="sm" disabled={proposals.isFetching} onClick={() => void proposals.refetch()}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Refresh
        </Button>
      </div>

      <form onSubmit={searchProposals} className="cp-card-native grid gap-3 p-4 sm:grid-cols-[1fr_1fr_2fr]">
        <div className="space-y-1.5">
          <Label htmlFor="proposal-state">Status</Label>
          <select id="proposal-state" className={selectClass} value={filter} onChange={event => { setFilter(event.target.value); setPages([]); }}>
            <option value="attention">Needs attention</option>
            <option value="open">Open votes</option>
            <option value="history">Proposal history</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proposal-kind">Proposal</Label>
          <select id="proposal-kind" className={selectClass} value={kind} onChange={event => { setKind(event.target.value); setPages([]); }}>
            <option value="all">All proposals</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="refund">Refunds</option>
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="proposal-search">Group or proposal ID</Label>
          <div className="flex gap-2">
            <Input id="proposal-search" className="min-w-0" value={search} maxLength={100}
              onChange={event => setSearch(event.target.value)} placeholder="Group name or ID" />
            <Button type="submit" variant="secondary">Search</Button>
          </div>
        </div>
      </form>

      {proposals.isPending && <p className="text-sm text-muted-foreground" role="status">Loading proposals…</p>}
      {proposals.isError && <p role="status" className="text-sm text-destructive">{rows ? "Refresh failed. Showing the last available results." : "Couldn’t load proposals. Refresh to retry."}</p>}
      {rows?.length === 0 && <div className="cp-card-native p-5 text-sm text-muted-foreground">No proposals match these filters.</div>}
      <div className="grid items-start gap-3 xl:grid-cols-2">
        {rows?.map(proposal => (
          <article key={proposal.kind + proposal.id} className="cp-card-native min-w-0 space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium capitalize text-muted-foreground">{proposal.kind}</p>
                <h3 className="break-words text-base font-semibold">{proposal.group_name || "Unavailable group"}</h3>
              </div>
              <Badge variant={proposal.attention ? "secondary" : "outline"} className="capitalize">
                {proposal.attention === "deadline_passed" ? "Deadline passed" : statusLabels[proposal.status ?? ""] || proposal.status || "Unknown"}
              </Badge>
            </div>
            {proposal.description && <p className="break-words text-sm text-muted-foreground">{proposal.description}</p>}
            {proposal.attention && <p className="rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-200">{detailByIssue[proposal.attention]}</p>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{proposal.kind === "refund" ? "Requested refund" : "Requested withdrawal"}</dt>
                <dd className="font-medium tabular-nums">{proposal.kind === "refund"
                  ? proposal.refund_percentage === null ? "Unavailable" : proposal.refund_percentage + "%"
                  : naira(proposal.amount ?? 0)}</dd>
                {proposal.fee_amount > 0 && <dd className="text-xs text-muted-foreground">Includes {naira(proposal.fee_amount)} fee</dd>}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Voting deadline (WAT)</dt>
                <dd className="font-medium">{time.format(new Date(proposal.deadline))}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Verified votes</dt>
                <dd className="font-medium tabular-nums">{proposal.eligible_voters === null
                  ? "Electorate snapshot unavailable"
                  : proposal.votes_for + " for · " + proposal.votes_against + " against · " + proposal.eligible_voters + " eligible · " + proposal.approval_threshold + "% approval threshold"}</dd>
              </div>
              {proposal.settled_refunds !== null && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Completed refund credits</dt>
                  <dd className="font-medium tabular-nums">{naira(proposal.settled_amount ?? 0)} · {proposal.settled_refunds} wallet credits</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
              <span className="break-all font-mono text-muted-foreground">{proposal.id}</span>
              {proposal.group_id && proposal.group_name && <Link className="inline-flex items-center gap-1 font-medium text-primary hover:underline" to={"/groups/" + proposal.group_id}>Open group <ArrowUpRight className="size-3" aria-hidden="true" /></Link>}
            </div>
          </article>
        ))}
      </div>
      {(pages.length > 0 || hasNext) && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={pages.length === 0 || proposals.isFetching} onClick={() => setPages(previous => previous.slice(0, -1))}><ChevronLeft className="mr-1 size-4" aria-hidden="true" /> Previous</Button>
          <span className="text-sm text-muted-foreground">Page {pages.length + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasNext || proposals.isFetching} onClick={next}>Next <ChevronRight className="ml-1 size-4" aria-hidden="true" /></Button>
        </div>
      )}
    </section>
  );
}
