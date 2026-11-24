import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type View = "users" | "groups" | "ledger" | "user_ledger" | "aml" | "penalties" | "external" | "audit"
  | "wallet_pending" | "wallet_history" | "payouts" | "inbound";
type Cursor = { id: string; cursor_at: string };
type PageOptions = { status?: string; filter?: string; search?: string; enabled?: boolean; ownerId?: string };
const pageSize = 25;

export function useAdminSearch(value: string) {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return debounced;
}

export function useAdminRecordPage<T>(adminId: string | undefined, view: View, options: PageOptions = {}) {
  const { status = "all", filter = "all", search = "", enabled = true, ownerId } = options;
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [lastFilter, setLastFilter] = useState({ adminId, view, status, filter, search, ownerId });
  const changed = lastFilter.adminId !== adminId || lastFilter.view !== view ||
    lastFilter.status !== status || lastFilter.filter !== filter || lastFilter.search !== search || lastFilter.ownerId !== ownerId;
  if (changed) {
    setLastFilter({ adminId, view, status, filter, search, ownerId });
    setCursors([]);
  }
  const history = changed ? [] : cursors;
  const before = history.at(-1);
  const query = useQuery({
    queryKey: ["admin-record-page", adminId, view, status, filter, search, ownerId, before],
    enabled: Boolean(adminId && enabled),
    gcTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_page_records", {
        p_view: view, p_status: status, p_filter: filter, p_search: search,
        p_before_at: before?.cursor_at, p_before_id: before?.id, p_limit: pageSize + 1, p_user_id: ownerId,
      }).abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const visible = query.data?.slice(0, pageSize) ?? [];
  const last = visible.at(-1);
  const hasNext = Boolean(last && (query.data?.length ?? 0) > pageSize);
  return {
    rows: visible.map(item => item.record as T),
    loaded: query.isSuccess,
    pending: query.isPending,
    refreshing: query.isFetching,
    failed: query.isError,
    retry: () => void query.refetch(),
    page: history.length + 1,
    previous: history.length ? () => setCursors(history.slice(0, -1)) : undefined,
    next: hasNext && last ? () => setCursors([...history, { id: last.id, cursor_at: last.cursor_at }]) : undefined,
  };
}

type Controls = Pick<ReturnType<typeof useAdminRecordPage>, "pending" | "failed" | "refreshing" | "retry" | "page" | "previous" | "next">;

export function AdminPageControls({ listing, label }: { listing: Controls; label: string }) {
  return (
    <div className="space-y-2">
      {listing.pending && <p className="text-sm text-muted-foreground" role="status">Loading {label}…</p>}
      {listing.failed && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Couldn’t load {label}. <Button type="button" variant="outline" size="sm" onClick={listing.retry}>Retry</Button>
      </div>}
      {(listing.previous || listing.next) && <nav aria-label={label + " pagination"} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2">
        <Button type="button" variant="outline" size="sm" disabled={!listing.previous || listing.refreshing} onClick={listing.previous}>
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">Page {listing.page}</span>
        <Button type="button" variant="outline" size="sm" disabled={!listing.next || listing.refreshing} onClick={listing.next}>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </nav>}
    </div>
  );
}
