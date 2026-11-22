import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, RefreshCw, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencySelector } from "@/components/wallet/CurrencySelector";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import CollectiPayReceipt from "@/components/receipt/CollectiPayReceipt";
import type { CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
const filters = {
  all: "All transactions",
  deposit: "Deposits",
  transfer: "Bank transfers",
  contribution: "Contributions",
  withdrawal: "Withdrawals",
  refund: "Refunds",
  vote: "Votes",
} as const;
const transactionTypes: Record<string, string> = {
  deposit: "Wallet deposit", transfer: "Bank transfer", contribution: "Group contribution", withdrawal: "Withdrawal", refund: "Group refund", vote: "Vote",
};

const metadata = (transaction: Transaction) => (transaction.metadata || {}) as Record<string, unknown>;
const metaText = (meta: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (typeof meta[key] === "string" && meta[key]) return meta[key] as string;
  }
  return undefined;
};

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });
const dateLabel = (value: string) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateFormat.format(parsed) : "Date unavailable";
};
const displayAmount = (value: number, currency: "NGN" | "USD") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(currency === "NGN" ? value : value / 1550);

export default function WalletHistory() {
  const [search, setSearch] = useSearchParams();
  const bankView = search.get("view") === "bank";
  const { user } = useSupabaseUser();
  const { contributions, transactions, loading, refreshContributionData } = useSupabaseContribution();
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [filter, setFilter] = useState<keyof typeof filters>("all");
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<CollectiPayReceiptData | null>(null);
  const virtualAccount = (user?.preferences as { virtualAccount?: unknown } | null)?.virtualAccount;
  const userId = user?.id;

  useEffect(() => {
    const ids = [...new Set(transactions.flatMap((item) => (
      item.user_id === userId && item.contribution_id ? [item.contribution_id] : []
    )))];
    if (ids.length === 0) return;
    let active = true;
    void Promise.resolve(supabase.from("contribution_groups").select("id, name").in("id", ids)).then(({ data }) => {
      if (active && data) setGroupNames(Object.fromEntries(data.map(({ id, name }) => [id, name])));
    });
    return () => { active = false; };
  }, [transactions, userId]);

  const groupName = (id: string | null) => id ? contributions.find((group) => group.id === id)?.name || groupNames[id] : undefined;
  const seen = new Set<string>();
  const rows = transactions.filter((transaction) => {
    if (transaction.user_id !== userId) return false;
    if (bankView) {
      if (transaction.type !== "deposit" || transaction.payment_method !== "bank_transfer") return false;
    } else if (filter !== "all" && transaction.type !== filter) return false;
    const meta = metadata(transaction);
    const paymentDetails = meta.paymentDetails as { transactionId?: string } | undefined;
    const reference = metaText(meta, "paymentReference", "transactionReference") || paymentDetails?.transactionId || transaction.id;
    if (seen.has(reference)) return false;
    seen.add(reference);
    return true;
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const openReceipt = (transaction: Transaction) => {
    const meta = metadata(transaction);
    const type = transaction.type;
    const kind = type === "deposit" || type === "withdrawal" || type === "refund" || type === "contribution" ? type : "transfer";
    const title = transactionTypes[type];
    const pool = groupName(transaction.contribution_id);
    const sender = type === "deposit" ? metaText(meta, "senderName") || "Bank transfer" : user?.name || user?.email;
    const recipient = metaText(meta, "recipientName", "account_name");
    const fee = Number(meta.fee);
    setSelected({
      kind, title, amount: Number(transaction.amount), date: transaction.created_at, status: transaction.status,
      fee: Number.isFinite(fee) ? fee : undefined,
      reference: metaText(meta, "transactionReference") || transaction.reference_id || transaction.id,
      transactionId: transaction.id,
      groupName: pool,
      narration: transaction.description || metaText(meta, "narration"),
      paymentMethod: (metaText(meta, "paymentMethod") || transaction.payment_method)?.replace(/_/g, " "),
      balanceBefore: transaction.balance_before ?? (meta.balance_before != null ? Number(meta.balance_before) : undefined),
      balanceAfter: transaction.balance_after ?? (meta.balance_after != null ? Number(meta.balance_after) : undefined),
      sender: sender ? { label: "From", name: sender, bankName: type === "deposit" ? metaText(meta, "senderBank", "bankName") : undefined } : undefined,
      recipient: pool ? { label: type === "refund" ? "Group" : "To pool", name: pool } : recipient
        ? { label: "To", name: recipient, bankName: metaText(meta, "bankName", "bank_name"), subtitle: metaText(meta, "accountNumber", "account_number") }
        : undefined,
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshContributionData();
    } finally {
      setRefreshing(false);
    }
  };

  const transactionList = (
    <Card className="mt-3 rounded-2xl">
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((transaction) => {
            const credit = transaction.type === "deposit" || transaction.type === "refund";
            const vote = transaction.type === "vote";
            const Icon = credit ? ArrowDownLeft : vote ? Vote : ArrowUpRight;
            const title = transactionTypes[transaction.type] || "Transaction";
            const pool = groupName(transaction.contribution_id);
            const status = transaction.status?.toLowerCase();
            return (
              <li key={transaction.id}>
                <button type="button" className="wallet-history-row hover:bg-muted/45 focus-visible:bg-muted/55" onClick={() => openReceipt(transaction)}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${credit ? "bg-accent text-primary" : "bg-muted text-foreground"}`}><Icon size={18} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold [overflow-wrap:anywhere]">{pool && transaction.type === "contribution" ? pool : title}</span>
                    <span className="block text-xs text-muted-foreground">{dateLabel(transaction.created_at)}{status && status !== "completed" && status !== "successful" && <span className="capitalize"> · {status}</span>}</span>
                  </span>
                  <span className={`min-w-0 break-words text-right text-sm font-semibold tabular-nums [overflow-wrap:anywhere] ${credit ? "text-primary" : ""}`}>
                    {!vote && transaction.amount > 0 ? `${credit ? "+" : "−"}${displayAmount(transaction.amount, currency)}` : <ChevronRight size={16} className="ml-auto text-muted-foreground" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3 p-5 text-center text-sm text-muted-foreground">
          <p role="status">{loading ? "Loading transactions…" : bankView ? "No bank deposits yet." : "No transactions match this view."}</p>
          {bankView && !virtualAccount && !loading && <Button asChild variant="outline"><Link to="/dashboard?wallet=bank">Set up bank account</Link></Button>}
          {!bankView && filter !== "all" && !loading && <Button variant="ghost" onClick={() => setFilter("all")}>Clear filter</Button>}
        </div>
      )}
    </Card>
  );

  return (
    <WalletFlow title="Wallet history" wide>
      <Tabs value={bankView ? "bank" : "wallet"} onValueChange={(value) => setSearch(value === "bank" ? { view: "bank" } : {}, { replace: true })}>
        <TabsList className="app-segmented grid w-full grid-cols-2" aria-label="Wallet history sections">
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="bank">Bank deposits</TabsTrigger>
        </TabsList>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {bankView ? (
            <Button variant="outline" className="gap-2 rounded-xl" disabled={refreshing} onClick={refresh}><RefreshCw size={15} className={refreshing ? "motion-safe:animate-spin" : ""} aria-hidden="true" /> Refresh</Button>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter transactions">
              {Object.entries(filters).map(([value, label]) => {
                const active = filter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as keyof typeof filters)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <CurrencySelector value={currency} onChange={setCurrency} />
        </div>
        {currency === "USD" && <p className="mt-2 text-xs text-muted-foreground">Approximate USD amounts</p>}
        <TabsContent value="wallet">{!bankView && transactionList}</TabsContent>
        <TabsContent value="bank">{bankView && transactionList}</TabsContent>
      </Tabs>
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-md border-none bg-transparent p-2 shadow-none sm:p-4">
          <DialogHeader className="sr-only"><DialogTitle>Transaction receipt</DialogTitle><DialogDescription>Wallet transaction details.</DialogDescription></DialogHeader>
          {selected && <CollectiPayReceipt data={selected} onDone={() => setSelected(null)} doneLabel="Close receipt" />}
        </DialogContent>
      </Dialog>
    </WalletFlow>
  );
}
