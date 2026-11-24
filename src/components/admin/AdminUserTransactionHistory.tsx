import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import CollectiPayReceipt, { type CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";
import { naira } from "@/services/supabase/pricingService";
import type { AdminEntity } from "./AdminEntityPicker";
import { AdminPageControls, useAdminRecordPage, useAdminSearch } from "./AdminRecordPage";

export type AdminTransaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  profiles?: { name: string | null; email: string | null };
  contribution_groups?: { name: string | null };
};

const dateFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos",
});
const types = ["deposit", "transfer", "contribution", "withdrawal", "refund", "payment"] as const;

export function AdminUserTransactionHistory({ adminId, account, onClose, returnFocus, receiptFor }: {
  adminId: string;
  account: AdminEntity;
  onClose: () => void;
  returnFocus: () => void;
  receiptFor: (transaction: AdminTransaction) => CollectiPayReceiptData;
}) {
  const [draft, setDraft] = useState("");
  const [type, setType] = useState("all");
  const [receipt, setReceipt] = useState<CollectiPayReceiptData | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const search = useAdminSearch(draft);
  const listing = useAdminRecordPage<AdminTransaction>(adminId, "user_ledger", { ownerId: account.id, status: type, search });

  useEffect(() => {
    dialog.current?.scrollTo({ top: 0 });
  }, [listing.page, receipt]);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent ref={dialog} className="sm:max-w-2xl" onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
        <DialogHeader>
          <DialogTitle>{receipt ? "Transaction receipt" : "Transaction history"}</DialogTitle>
          <DialogDescription className="break-words">
            {account.name}{account.description && account.description !== account.name ? " · " + account.description : ""}
          </DialogDescription>
        </DialogHeader>
        {receipt ? (
          <CollectiPayReceipt data={receipt} onDone={() => setReceipt(null)} doneLabel="Back to history" />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input type="search" aria-label="Search account transactions" placeholder="Search by reference or description"
                maxLength={180} value={draft} onChange={event => setDraft(event.target.value)} />
              <select aria-label="Transaction type" className="h-10 rounded-lg border bg-background px-3 text-sm capitalize"
                value={type} onChange={event => setType(event.target.value)}>
                <option value="all">All types</option>
                {types.map(value => <option key={value} value={value} className="capitalize">{value[0].toUpperCase() + value.slice(1)}</option>)}
              </select>
            </div>
            {listing.loaded && listing.rows.length === 0 &&
              <p className="rounded-xl border p-5 text-center text-sm text-muted-foreground">No transactions found.</p>}
            {listing.rows.length > 0 && <ul className="divide-y overflow-hidden rounded-xl border">
              {listing.rows.map(transaction => {
                const date = transaction.created_at ? new Date(transaction.created_at) : null;
                return <li key={transaction.id}>
                  <button type="button" onClick={() => setReceipt(receiptFor(transaction))}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-sm font-semibold capitalize">{transaction.type.replace(/_/g, " ")}</p>
                      <p className="break-words text-xs text-muted-foreground">{transaction.description || transaction.contribution_groups?.name || transaction.reference_id || transaction.id}</p>
                      {date && Number.isFinite(date.getTime()) && <time dateTime={transaction.created_at ?? undefined} className="block text-xs text-muted-foreground">{dateFormat.format(date)} WAT</time>}
                    </div>
                    <div className="min-w-0 space-y-1 text-right">
                      <p className="break-all text-sm font-semibold tabular-nums">{naira.format(transaction.amount)}</p>
                      <Badge variant="outline" className="capitalize">{transaction.status?.replace(/_/g, " ") || "Unknown"}</Badge>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>;
              })}
            </ul>}
            <AdminPageControls listing={listing} label="account transactions" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
