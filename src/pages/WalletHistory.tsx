import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  ReceiptText,
  RefreshCw,
  Search,
  Vote,
  Wallet,
  X,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import Header from "@/components/layout/Header";
import BrandLoader from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/button";
import { WalletReportLinks } from "@/components/wallet/WalletReportLinks";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { completedLedgerEntry, walletMovement } from "@/services/supabase/monthlyLedger";
import { supportLink } from "@/services/supabase/supportService";
import { useTransferStatus } from "@/hooks/useTransferStatus";
import { CurrencySelector } from "@/components/wallet/CurrencySelector";
import CollectiPayReceipt from "@/components/receipt/CollectiPayReceipt";
import type { CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  formatPaymentMethodLabel,
  getDepositSender,
  getFailureReason,
  getTransferRecipient,
  metaText,
} from "@/utils/transactionDisplay";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const filters = {
  all: "All",
  deposit: "Deposits",
  transfer: "Transfers",
  contribution: "Contributions",
  withdrawal: "Withdrawals",
  refund: "Refunds",
  vote: "Votes",
} as const;

const transactionTypes: Record<string, string> = {
  deposit: "Wallet deposit",
  transfer: "Bank transfer",
  contribution: "Group contribution",
  withdrawal: "Withdrawal",
  refund: "Group refund",
  payment: "Payment",
  vote: "Governance vote",
};

const metadata = (transaction: Transaction) => (transaction.metadata || {}) as Record<string, unknown>;

const displayAmount = (value: number, currency: "NGN" | "USD") =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(currency === "NGN" ? value : value / 1550);

const formatGroupDay = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Earlier";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM yyyy");
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, "h:mm a") : "";
};

export default function WalletHistory() {
  const [search, setSearch] = useSearchParams();
  const bankView = search.get("view") === "bank";
  const { user } = useSupabaseUser();
  const { contributions, transactions, transactionsLoading: loading, refreshContributionData } = useSupabaseContribution();
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [filter, setFilter] = useState<keyof typeof filters>("all");
  const [query, setQuery] = useState("");
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<(CollectiPayReceiptData & { supportUrl?: string }) | null>(null);
  const updateReceiptStatus = useCallback((status: string) => {
    setSelected((receipt) => receipt ? { ...receipt, status } : receipt);
  }, []);
  useTransferStatus(selected?.reference, selected?.status, user?.id, updateReceiptStatus);

  const virtualAccount = (user?.preferences as { virtualAccount?: unknown } | null)?.virtualAccount;
  const userId = user?.id;

  useEffect(() => {
    const ids = [
      ...new Set(
        transactions.flatMap((item) =>
          item.user_id === userId && item.contribution_id ? [item.contribution_id] : []
        )
      ),
    ];
    if (ids.length === 0) return;
    let active = true;
    void Promise.resolve(supabase.from("contribution_groups").select("id, name").in("id", ids)).then(
      ({ data }) => {
        if (active && data) {
          setGroupNames(Object.fromEntries(data.map(({ id, name }) => [id, name])));
        }
      }
    );
    return () => {
      active = false;
    };
  }, [transactions, userId]);

  const groupName = (id: string | null) =>
    id ? contributions.find((group) => group.id === id)?.name || groupNames[id] : undefined;

  // Deduplicated personal ledger
  const userLedger = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter((tx) => {
        if (tx.user_id !== userId) return false;
        const meta = metadata(tx);
        const paymentDetails = meta.paymentDetails as { transactionId?: string } | undefined;
        const reference =
          metaText(meta, "paymentReference", "transactionReference") ||
          paymentDetails?.transactionId ||
          tx.id;
        if (seen.has(reference)) return false;
        seen.add(reference);
        return true;
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [transactions, userId]);

  // Hero inflow / outflow metrics
  const { totalInflow, totalOutflow } = useMemo(() => {
    return userLedger.reduce(
      (acc, tx) => {
        if (!completedLedgerEntry(tx)) return acc;
        const movement = walletMovement(tx);
        if (movement > 0) acc.totalInflow += movement;
        if (movement < 0) acc.totalOutflow -= movement;
        return acc;
      },
      { totalInflow: 0, totalOutflow: 0 }
    );
  }, [userLedger]);

  // Filtered rows
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return userLedger.filter((tx) => {
      if (bankView) {
        if (tx.type !== "deposit" || tx.payment_method !== "bank_transfer") return false;
      } else if (filter !== "all" && tx.type !== filter) {
        return false;
      }
      if (!q) return true;
      const pool = groupName(tx.contribution_id)?.toLowerCase() || "";
      const title = (transactionTypes[tx.type] || "").toLowerCase();
      const meta = metadata(tx);
      const depositSender = getDepositSender(meta);
      const transferRecipient = getTransferRecipient(meta);
      return (
        pool.includes(q) ||
        title.includes(q) ||
        (tx.description || "").toLowerCase().includes(q) ||
        (tx.reference_id || "").toLowerCase().includes(q) ||
        (depositSender.name || "").toLowerCase().includes(q) ||
        (depositSender.bankName || "").toLowerCase().includes(q) ||
        (transferRecipient.name || "").toLowerCase().includes(q) ||
        (transferRecipient.bankName || "").toLowerCase().includes(q)
      );
    });
  }, [userLedger, bankView, filter, query, contributions, groupNames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Date-grouped sections for effortless scanning
  const groupedSections = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    for (const tx of rows) {
      const label = formatGroupDay(tx.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(tx);
      } else {
        groups.push({ label, items: [tx] });
      }
    }
    return groups;
  }, [rows]);

  const openReceipt = (transaction: Transaction) => {
    const meta = metadata(transaction);
    const type = transaction.type;
    const kind =
      type === "deposit" || type === "withdrawal" || type === "refund" || type === "contribution"
        ? type
        : "transfer";
    const savingsMovement = transaction.payment_method === "fixed_savings";
    const title = savingsMovement ? transaction.description || "Ice Vault" : transactionTypes[type];
    const pool = groupName(transaction.contribution_id);
    const depositSender = getDepositSender(meta);
    const transferRecipient = getTransferRecipient(meta);
    const failureReason = getFailureReason(meta, transaction.status);
    const fee = Number(meta.fee);
    const groupPayout = type === "withdrawal" && Boolean(transaction.contribution_id) && meta.gross_amount != null;
    const va = virtualAccount as { accountNumber?: string; bankName?: string } | undefined;

    const extraRows = groupPayout
      ? [
          { label: "Gross group withdrawal", value: displayAmount(Number(meta.gross_amount), "NGN") },
          { label: "Platform fee", value: displayAmount(fee || 0, "NGN") },
          { label: "Wallet credited", value: displayAmount(Number(transaction.amount), "NGN"), highlight: true },
        ]
      : failureReason
      ? [
          { label: "Failure Reason", value: failureReason },
          { label: "Wallet Refund", value: "Refunded automatically", highlight: true },
        ]
      : undefined;

    setSelected({
      supportUrl: transaction.bulk_batch_id ? supportLink("bulk_transfer", transaction.bulk_batch_id)
        : type === "transfer" ? supportLink("transfer", transaction.id)
        : savingsMovement && typeof meta.savings_id === "string" ? supportLink("ice_vault", meta.savings_id)
        : groupPayout ? supportLink("group_withdrawal", transaction.id)
        : type === "refund" && transaction.contribution_id ? supportLink("group_refund", transaction.id) : undefined,
      kind,
      title,
      amount: Number(transaction.amount),
      date: transaction.created_at,
      status: transaction.status,
      fee: !groupPayout && Number.isFinite(fee) ? fee : undefined,
      vat: transaction.payment_method === "bulk_bank_transfer" ? Number(meta.vat) || 0 : undefined,
      reference: metaText(meta, "transactionReference") || transaction.reference_id || transaction.id,
      transactionId: transaction.id,
      groupName: pool,
      narration: transaction.description || metaText(meta, "narration"),
      paymentMethod: formatPaymentMethodLabel(
        metaText(meta, "paymentMethod") || transaction.payment_method
      ),
      balanceBefore:
        transaction.balance_before ??
        (meta.balance_before != null ? Number(meta.balance_before) : undefined),
      balanceAfter:
        transaction.balance_after ??
        (meta.balance_after != null ? Number(meta.balance_after) : undefined),
      sender:
        savingsMovement ? { label: "From", name: type === "deposit" ? "Ice Vault" : "CollectiPay Wallet" } :
        groupPayout
          ? { label: "From pool", name: pool || "Group" }
          : type === "deposit"
          ? {
              label: "From",
              name: depositSender.name || "Bank Transfer",
              subtitle: depositSender.accountNumber,
              bankName: depositSender.bankName,
            }
          : user?.name || user?.email
          ? {
              label: "From",
              name: user?.name || user?.email || "CollectiPay Wallet",
              subtitle: va?.accountNumber || "CollectiPay Wallet",
              bankName: va?.bankName,
            }
          : undefined,
      recipient: savingsMovement ? { label: "To", name: type === "deposit" ? "CollectiPay Wallet" : "Ice Vault" } : groupPayout
        ? { label: "To wallet", name: user?.name || "CollectiPay wallet" }
        : pool
        ? { label: type === "refund" ? "Group" : "To pool", name: pool }
        : type === "deposit"
        ? {
            label: "To Wallet",
            name: user?.name || user?.email || "Your CollectiPay Wallet",
            subtitle:
              metaText(meta, "virtualAccountNumber") || va?.accountNumber || "CollectiPay Wallet",
            bankName: va?.bankName,
          }
        : transferRecipient.name || transferRecipient.bankName
        ? {
            label: "To",
            name: transferRecipient.name || "Bank Account",
            bankName: transferRecipient.bankName,
            subtitle: transferRecipient.accountNumber,
          }
        : undefined,
      extraRows,
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshContributionData(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <Header mobilePanel />

      <main className="app-page app-panel-page cp-page-enter max-w-3xl">
        {/* Deep-Emerald Wallet Ledger Hero */}
        <section className="app-panel-hero" aria-labelledby="wallet-history-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="ghost" className="group-detail-back gap-1.5 px-0">
              <Link to="/dashboard">
                <ArrowLeft size={16} aria-hidden="true" />
                Wallet
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <CurrencySelector value={currency} onChange={setCurrency} onDark />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={refreshing}
                onClick={refresh}
                aria-label="Refresh wallet history"
                className="app-panel-secondary h-10 w-10 rounded-xl"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
          <h1 id="wallet-history-title" className="app-page-title mt-3">
            Wallet history
          </h1>
          <p className="panel-kicker mt-1 text-sm">
            Tap any entry to view, download, or share its verified CollectiPay receipt.
          </p>

          {/* 3-Column Financial Strip */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Money in</span>
              <span className="mt-1 block truncate text-base font-extrabold tabular-nums text-[#dbf5b4] sm:text-xl">
                +{displayAmount(totalInflow, currency)}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Money out</span>
              <span className="mt-1 block truncate text-base font-extrabold tabular-nums text-white sm:text-xl">
                −{displayAmount(totalOutflow, currency)}
              </span>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-sm">
              <span className="block text-[11px] text-[#c3e4d4]">Balance</span>
              <span className="mt-1 block truncate text-base font-extrabold tabular-nums text-white sm:text-xl">
                {displayAmount(Number(user?.wallet_balance || 0), currency)}
              </span>
            </div>
          </div>
        </section>

        {/* Overlapping Sheet Body */}
        <div className="app-panel-body space-y-4">
          <WalletReportLinks scope="wallet" />
          <Button asChild variant="ghost" className="h-10 px-2 text-primary"><Link to="/transfer/bulk/history">Bulk transfer history</Link></Button>
          <Tabs
            value={bankView ? "bank" : "wallet"}
            onValueChange={(value) =>
              setSearch(value === "bank" ? { view: "bank" } : {}, { replace: true })
            }
          >
            <TabsList
              className="app-segmented grid w-full grid-cols-2 bg-muted/60 p-1"
              aria-label="Wallet history view"
            >
              <TabsTrigger value="wallet" className="gap-1.5">
                <Wallet className="h-4 w-4" />
                <span>All Wallet</span>
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                <span>Bank Deposits</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Clean Search + Pill Filters */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by pool, reference, or note…"
                className="h-11 rounded-xl bg-card pl-10 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!bankView && (
              <div
                className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
                role="group"
                aria-label="Filter transactions"
              >
                {Object.entries(filters).map(([value, label]) => {
                  const active = filter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as keyof typeof filters)}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
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
          </div>

          {/* Date-Grouped Clean Ledger */}
          {loading && userLedger.length === 0 ? (
            <BrandLoader
              variant="page"
              message="Loading wallet history"
              submessage="Fetching your deposits, transfers, and pool receipts…"
            />
          ) : groupedSections.length === 0 ? (
            <div className="cp-card-native flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
                <ReceiptText className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-base font-bold text-foreground">
                {bankView ? "No bank deposits yet" : "No transactions found"}
              </h2>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {bankView
                  ? "Transfers to your personal CollectiPay virtual account appear here automatically."
                  : "Try clearing your search or filter, or fund your wallet to get started."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {bankView && !virtualAccount ? (
                  <Button asChild className="h-10 rounded-xl">
                    <Link to="/dashboard?wallet=bank">Set up bank account</Link>
                  </Button>
                ) : (
                  (filter !== "all" || query) && (
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedSections.map((section) => (
                <section key={section.label} className="space-y-2">
                  <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </h2>

                  <div className="cp-card-native divide-y divide-border/70 overflow-hidden">
                    {section.items.map((tx) => {
                      const meta = metadata(tx);
                      const groupPayout = tx.type === "withdrawal" && Boolean(tx.contribution_id) && meta.gross_amount != null;
                      const credit = tx.type === "deposit" || tx.type === "refund" || groupPayout;
                      const vote = tx.type === "vote";
                      const Icon = credit ? ArrowDownLeft : vote ? Vote : ArrowUpRight;
                      const pool = groupName(tx.contribution_id);
                      const isPenalty = meta.category === "admin_penalty";
                      const primaryTitle = tx.payment_method === "fixed_savings"
                        ? tx.description || "Ice Vault"
                        : isPenalty
                        ? "Compliance penalty"
                        : groupPayout
                        ? "Group payout"
                        : pool && tx.type === "contribution"
                        ? pool
                        : transactionTypes[tx.type] || "Transaction";
                      const depositSender = getDepositSender(meta);
                      const transferRecipient = getTransferRecipient(meta);
                      const subtitleParts = [
                        formatTime(tx.created_at),
                        pool && tx.type !== "contribution" ? pool : null,
                        tx.type === "transfer" || tx.type === "withdrawal"
                          ? [transferRecipient.name, transferRecipient.bankName].filter(Boolean).join(" • ") || null
                          : null,
                        tx.type === "deposit"
                          ? [depositSender.name, depositSender.bankName].filter(Boolean).join(" • ") || null
                          : null,
                      ].filter(Boolean);
                      const status = tx.status?.toLowerCase();
                      const showStatusBadge =
                        status && status !== "completed" && status !== "successful";

                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => openReceipt(tx)}
                          className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/45 focus-visible:bg-muted/55 focus-visible:outline-none"
                        >
                          <span
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                              credit
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                : vote
                                ? "bg-accent text-primary"
                                : "bg-muted text-foreground"
                            )}
                          >
                            <Icon size={18} aria-hidden="true" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-foreground">
                                {primaryTitle}
                              </span>
                              {showStatusBadge && (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                                    status === "failed"
                                      ? "bg-destructive/12 text-destructive"
                                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  )}
                                >
                                  {status}
                                </span>
                              )}
                            </div>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {subtitleParts.join(" · ")}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 text-right">
                            {!vote && Number(tx.amount || 0) > 0 ? (
                              <span
                                className={cn(
                                  "text-sm font-extrabold tabular-nums",
                                  credit
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-foreground"
                                )}
                              >
                                {credit ? "+" : "−"}
                                {displayAmount(Number(tx.amount), currency)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-primary">Receipt</span>
                            )}
                            <ChevronRight
                              size={15}
                              className="text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                              aria-hidden="true"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction receipt</DialogTitle>
            <DialogDescription>Verified CollectiPay wallet transaction receipt.</DialogDescription>
          </DialogHeader>
          {selected && (
            <CollectiPayReceipt
              data={selected}
              onDone={() => setSelected(null)}
              doneLabel="Close receipt"
            />
          )}
          {selected?.supportUrl && <Button asChild variant="secondary" className="w-full"><Link to={selected.supportUrl}>Get help with this transaction</Link></Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
