import { useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { cn } from "@/lib/utils";
import {
  listSupportTickets, loadSupportTicket, replyToSupportTicket, updateSupportTickets,
  supportCategories, supportPageSize, supportStatuses,
  type SupportCategory, type SupportMessage, type SupportStatus, type SupportTicket,
} from "@/services/supabase/supportService";

const dateLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const options = Object.entries(supportStatuses);
const selectStyle = "h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground";

function TicketStatus({ status }: { status: SupportStatus }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", {
    open: "bg-primary/10 text-primary",
    in_review: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    waiting: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    resolved: "bg-muted text-muted-foreground",
  }[status])}>{supportStatuses[status]}</span>;
}

function TicketThread({ id, admin, userId, onBack, onUpdate }: {
  id: string; admin: boolean; userId: string; onBack: () => void;
  onUpdate: (status: SupportStatus, items: SupportTicket[]) => Promise<void>;
}) {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [earlier, setEarlier] = useState<SupportMessage[]>([]);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState(false);
  const replyKey = useRef<string>();
  const detail = useQuery({
    queryKey: ["support", userId, admin, "thread", id],
    queryFn: ({ signal }) => loadSupportTicket(id, admin, signal),
    refetchInterval: 15_000,
  });
  const thread = detail.data;
  const latest = thread?.messages.slice(0, supportPageSize) ?? [];
  const messages = [...new Map([...earlier, ...latest].map((message) => [message.id, message])).values()].sort((a, b) => a.id - b.id);
  const [hasEarlierOverride, setHasEarlierOverride] = useState<boolean>();
  const hasEarlier = hasEarlierOverride ?? ((thread?.messages.length ?? 0) > supportPageSize);
  const getEarlier = async () => {
    if (!messages.length || reading) return;
    setReading(true);
    try {
      const result = await loadSupportTicket(id, admin, AbortSignal.timeout(12_000), messages[0].id);
      setEarlier(messages.concat(result.messages.slice(0, supportPageSize)));
      setHasEarlierOverride(result.messages.length > supportPageSize);
    } catch {
      toast.error("Couldn’t load earlier messages.");
    } finally { setReading(false); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || body.trim().length < 2) return;
    setSending(true);
    replyKey.current ??= crypto.randomUUID();
    try {
      await replyToSupportTicket(id, admin, replyKey.current, body);
      replyKey.current = undefined;
      setBody("");
      await client.invalidateQueries({ queryKey: ["support", userId, admin] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t send the reply.");
    } finally { setSending(false); }
  };

  return (
    <section className="cp-card-native min-w-0 space-y-4 p-4 sm:p-6" aria-label="Ticket conversation">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-2"><ArrowLeft size={16} /> All tickets</Button>
      {detail.isPending && <p role="status" className="text-sm text-muted-foreground">Loading ticket…</p>}
      {detail.isError && <p role="alert" className="text-sm text-destructive">{detail.error.message}</p>}
      {thread && <>
        <div className="space-y-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatus status={thread.status} />
            <span className="text-xs font-medium text-muted-foreground">#{id.slice(-8).toUpperCase()} · {supportCategories[thread.category]}</span>
          </div>
          <h2 className="break-words text-xl font-semibold">{thread.subject}</h2>
          {admin && thread.owner_name && <p className="text-sm text-muted-foreground">{thread.owner_name}</p>}
          {thread.reference && <p className="break-all text-xs text-muted-foreground">Reference {thread.reference}</p>}
          {admin && <label className="flex flex-wrap items-center gap-3 pt-1 text-sm">
            Status
            <select className={selectStyle} value={thread.status} disabled={changing} onChange={async (event) => {
              setChanging(true);
              try { await onUpdate(event.target.value as SupportStatus, [thread]); }
              finally { setChanging(false); }
            }}>
              {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
        </div>
        {hasEarlier && <Button variant="outline" size="sm" onClick={() => void getEarlier()} disabled={reading}>{reading ? "Loading…" : "Earlier messages"}</Button>}
        <ol className="space-y-2.5">
          {messages.map((message) => <li key={message.id} className={cn("break-words rounded-xl border p-3 sm:p-4", message.from_support ? "border-primary/20 bg-primary/5" : "bg-muted/35")}>
            <div className="mb-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold">{message.from_support ? "CollectiPay support" : admin ? "Customer" : "You"}</span>
              <time dateTime={message.created_at} className="text-muted-foreground">{dateLabel.format(new Date(message.created_at))}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
          </li>)}
        </ol>
        {thread.status === "resolved" ? <p className="text-sm text-muted-foreground">This ticket is resolved.</p> : (
          <form onSubmit={(event) => void send(event)} className="space-y-2.5">
            <Label htmlFor="support-reply">Reply</Label>
            <Textarea id="support-reply" value={body} onChange={(event) => setBody(event.target.value)} disabled={sending} maxLength={4000} required />
            <Button className="gap-2" disabled={sending || body.trim().length < 2}>{sending && <Loader2 className="animate-spin" size={16} />} Send reply</Button>
          </form>
        )}
      </>}
    </section>
  );
}

export function SupportInbox({ admin = false, selected, onSelect }: {
  admin?: boolean; selected: string | null; onSelect: (id: string | null) => void;
}) {
  const { user } = useSupabaseUser();
  const client = useQueryClient();
  const userId = user?.id ?? "";
  const [status, setStatus] = useState<SupportStatus | "">("");
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [target, setTarget] = useState<SupportStatus>("in_review");
  const [updating, setUpdating] = useState(false);
  const list = useInfiniteQuery({
    queryKey: ["support", userId, admin, "list", status, category, search],
    queryFn: ({ pageParam, signal }) => listSupportTickets(admin, { status, category, search }, pageParam, signal),
    initialPageParam: null as SupportTicket | null,
    getNextPageParam: (page) => page.length > supportPageSize ? page[supportPageSize - 1] : undefined,
    enabled: Boolean(userId) && !selected,
  });
  const tickets = list.data?.pages.flatMap((page) => page.slice(0, supportPageSize)) ?? [];
  const chosen = tickets.filter((ticket) => checkedIds.includes(ticket.id));
  const change = async (next: SupportStatus, items: SupportTicket[]) => {
    if (!items.length) return;
    try {
      const count = await updateSupportTickets(next, items);
      toast.success(count ? `${count} ${count === 1 ? "ticket" : "tickets"} updated` : "Ticket status is current or has changed");
      if (count < items.length && count > 0) toast.info("Some tickets changed before this update. Check their latest status.");
      setCheckedIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update the tickets.");
    } finally { await client.invalidateQueries({ queryKey: ["support", userId, admin] }); }
  };

  if (selected && userId) return <TicketThread key={selected} id={selected} admin={admin} userId={userId} onBack={() => onSelect(null)} onUpdate={change} />;

  return (
    <section className="cp-card-native min-w-0 space-y-4 p-4 sm:p-6" aria-label={admin ? "Support queue" : "Your tickets"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{admin ? "Support queue" : "Your tickets"}</h2>
        <select aria-label="Filter tickets by status" className={selectStyle} value={status} onChange={(event) => {
          setStatus(event.target.value as SupportStatus | "");
          setCheckedIds([]);
        }}>
          <option value="">All statuses</option>
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {admin && <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        setCheckedIds([]);
        setSearch(searchDraft.trim());
      }}>
        <Input type="search" className="min-w-36 flex-1" aria-label="Search tickets" placeholder="Search by subject, ticket or payment reference" maxLength={120} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <select aria-label="Filter tickets by topic" className={selectStyle} value={category} onChange={(event) => {
          setCategory(event.target.value as SupportCategory | "");
          setCheckedIds([]);
        }}>
          <option value="">All topics</option>
          {Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button type="submit" variant="outline">Search</Button>
      </form>}
      {admin && tickets.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2.5">
        <Checkbox id="support-select-page" disabled={updating} checked={tickets.slice(0, supportPageSize).every(({ id }) => checkedIds.includes(id))} onCheckedChange={(checked) => setCheckedIds(checked ? tickets.slice(0, supportPageSize).map(({ id }) => id) : [])} />
        <Label htmlFor="support-select-page" className="mr-auto text-xs">{chosen.length ? `${chosen.length} selected` : "Select up to 30"}</Label>
        <select aria-label="Status for selected tickets" className={selectStyle} value={target} onChange={(event) => setTarget(event.target.value as SupportStatus)}>
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button size="sm" disabled={!chosen.length || updating} onClick={async () => {
          setUpdating(true);
          try { await change(target, chosen); }
          finally { setUpdating(false); }
        }}>Update tickets</Button>
      </div>}
      {list.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading tickets…</p> : list.isError ? (
        <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Couldn’t load tickets.</p><Button variant="outline" size="sm" onClick={() => void list.refetch()}>Try again</Button></div>
      ) : tickets.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><LifeBuoy size={24} /><p>No tickets match this view.</p></div>
      ) : <ul className="divide-y rounded-xl border">
        {tickets.map((ticket) => <li key={ticket.id} className="flex min-w-0 items-center gap-2 px-3">
          {admin && <Checkbox aria-label={`Select ${ticket.subject}`} checked={checkedIds.includes(ticket.id)} disabled={updating || checkedIds.length >= supportPageSize && !checkedIds.includes(ticket.id)}
            onCheckedChange={(checked) => setCheckedIds((ids) => checked ? [...ids, ticket.id] : ids.filter((id) => id !== ticket.id))} />}
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-3 text-left hover:bg-muted/40 sm:gap-3" onClick={() => onSelect(ticket.id)}>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold">{ticket.subject}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">#{ticket.id.slice(-8).toUpperCase()} · {ticket.owner_name || supportCategories[ticket.category]}</p>
            </div>
            <TicketStatus status={ticket.status} />
            <ChevronRight className="hidden shrink-0 text-muted-foreground sm:block" aria-hidden="true" size={16} />
          </button>
        </li>)}
      </ul>}
      {list.hasNextPage && <Button variant="outline" size="sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? "Loading…" : "Load more"}</Button>}
    </section>
  );
}
