import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Vote as VoteIcon,
  Users,
  RefreshCw,
  Search,
  Receipt,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { format, isValid, isToday, isYesterday } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CollectiPayReceipt, { type CollectiPayReceiptData, type ReceiptKind } from "@/components/receipt/CollectiPayReceipt";
import { cn } from "@/lib/utils";
import {
  formatPaymentMethodLabel,
  getDepositSender,
  getFailureReason,
  getTransferRecipient,
} from "@/utils/transactionDisplay";

type ActivityFilter = "all" | "in" | "out" | "groups" | "votes";

const statusPillStyles: Record<string, string> = {
  completed: "bg-accent text-accent-foreground",
  successful: "bg-accent text-accent-foreground",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

const titleMap: Record<string, string> = {
  deposit: "Wallet Deposit",
  withdrawal: "Wallet Withdrawal",
  contribution: "Group Contribution",
  transfer: "Bank Transfer",
  refund: "Group Refund",
  vote: "Governance Vote",
};

const ActivityHistory = () => {
  const { user } = useSupabaseUser();
  const { transactions, contributions } = useSupabaseContribution();
  const [activeTab, setActiveTab] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<CollectiPayReceiptData | null>(null);

  const userTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.user_id === user?.id && t.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, user?.id]);

  // Summary metrics across all user activity
  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let groupCount = 0;

    for (const tx of userTransactions) {
      if (String(tx.status || "").toLowerCase() === "failed") continue;
      const amt = Number(tx.amount || 0);
      if (tx.type === "deposit" || tx.type === "refund") {
        totalIn += amt;
      } else if (tx.type === "withdrawal" || tx.type === "transfer" || tx.type === "contribution") {
        totalOut += amt;
      }
      if (tx.contribution_id || tx.type === "contribution" || tx.type === "refund") {
        groupCount += 1;
      }
    }

    return {
      totalIn,
      totalOut,
      count: userTransactions.length,
      groupCount,
    };
  }, [userTransactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return userTransactions.filter((tx) => {
      if (activeTab === "in" && tx.type !== "deposit" && tx.type !== "refund") return false;
      if (
        activeTab === "out" &&
        tx.type !== "withdrawal" &&
        tx.type !== "transfer" &&
        tx.type !== "contribution"
      ) {
        return false;
      }
      if (
        activeTab === "groups" &&
        !tx.contribution_id &&
        tx.type !== "contribution" &&
        tx.type !== "refund"
      ) {
        return false;
      }
      if (activeTab === "votes" && tx.type !== "vote") return false;

      if (!q) return true;
      const group = contributions.find((c) => c.id === tx.contribution_id);
      const meta = (tx.metadata || {}) as Record<string, unknown>;
      const depositSender = getDepositSender(meta);
      const transferRecipient = getTransferRecipient(meta);
      const haystack = [
        titleMap[tx.type] || tx.type,
        group?.name,
        tx.description,
        tx.reference_id,
        depositSender.name,
        depositSender.bankName,
        transferRecipient.name,
        transferRecipient.bankName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [userTransactions, activeTab, searchQuery, contributions]);

  // Group transactions by human-friendly date buckets
  const groupedByDate = useMemo(() => {
    const groups: { label: string; items: typeof filteredTransactions }[] = [];
    const map = new Map<string, typeof filteredTransactions>();

    for (const tx of filteredTransactions) {
      const d = new Date(tx.created_at);
      const label = !isValid(d)
        ? "Earlier"
        : isToday(d)
        ? "Today"
        : isYesterday(d)
        ? "Yesterday"
        : format(d, "MMMM d, yyyy");

      if (!map.has(label)) {
        const list: typeof filteredTransactions = [];
        map.set(label, list);
        groups.push({ label, items: list });
      }
      map.get(label)!.push(tx);
    }
    return groups;
  }, [filteredTransactions]);

  const openReceiptForTx = (tx: any) => {
    if (tx.type === "vote") return;

    const group = contributions.find((c) => c.id === tx.contribution_id);
    const meta = (tx.metadata || {}) as Record<string, unknown>;
    const rawType = String(tx.type || "deposit").toLowerCase();

    const kind: ReceiptKind =
      rawType === "deposit"
        ? "deposit"
        : rawType === "withdrawal"
        ? "withdrawal"
        : rawType === "refund"
        ? "refund"
        : rawType === "contribution" || tx.contribution_id
        ? "contribution"
        : "transfer";

    const isInbound = kind === "deposit" || kind === "refund";
    const userPrefs = (user?.preferences || {}) as Record<string, any>;
    const depositSender = getDepositSender(meta);
    const transferRecipient = getTransferRecipient(meta);
    const failureReason = getFailureReason(meta, tx.status);

    const extraRows = failureReason
      ? [
          { label: "Failure Reason", value: failureReason },
          { label: "Wallet Refund", value: "Refunded automatically", highlight: true },
        ]
      : undefined;

    setSelectedReceipt({
      kind,
      title: titleMap[rawType] || "Transaction Receipt",
      amount: Number(tx.amount || 0),
      fee: meta.fee ? Number(meta.fee) : undefined,
      status: tx.status || "completed",
      date: tx.created_at,
      reference: (meta.transactionReference as string) || tx.reference_id || tx.id,
      transactionId: tx.id ? String(tx.id) : undefined,
      groupName: group?.name,
      groupProgress:
        group && Number(group.target_amount) > 0
          ? {
              raised: Number(group.current_amount || 0),
              target: Number(group.target_amount || 0),
            }
          : undefined,
      paymentMethod:
        formatPaymentMethodLabel((meta.paymentMethod as string) || tx.payment_method) ||
        (kind === "deposit" ? "Bank Transfer" : "CollectiPay Wallet"),
      narration: tx.description || (meta.narration as string | undefined),
      balanceBefore:
        tx.balance_before != null
          ? Number(tx.balance_before)
          : meta.balance_before !== undefined
          ? Number(meta.balance_before)
          : undefined,
      balanceAfter:
        tx.balance_after != null
          ? Number(tx.balance_after)
          : meta.balance_after !== undefined
          ? Number(meta.balance_after)
          : undefined,
      votingRightsGranted: kind === "contribution",
      sender: isInbound
        ? {
            label: "From",
            name:
              depositSender.name ||
              (kind === "refund" ? group?.name || "Group Pool" : "Bank Transfer"),
            subtitle:
              depositSender.accountNumber ||
              (meta.payerEmail as string | undefined) ||
              (meta.accountNumber as string | undefined),
            bankName: depositSender.bankName,
          }
        : {
            label: "From",
            name: user?.name || user?.email || "CollectiPay Wallet",
            subtitle: userPrefs?.virtualAccount?.accountNumber || "CollectiPay Wallet",
            bankName: userPrefs?.virtualAccount?.bankName,
          },
      recipient:
        kind === "contribution" && group
          ? {
              label: "To Pool",
              name: group.name,
              subtitle: group.account_number || "Group Contribution Vault",
              bankName: group.bank_name || undefined,
            }
          : isInbound
          ? {
              label: "To Wallet",
              name: user?.name || user?.email || "Your Wallet",
              subtitle:
                (meta.virtualAccountNumber as string | undefined) ||
                userPrefs?.virtualAccount?.accountNumber ||
                "CollectiPay Wallet",
              bankName: userPrefs?.virtualAccount?.bankName,
            }
          : {
              label: "To",
              name: transferRecipient.name || "Bank Account",
              subtitle: transferRecipient.accountNumber,
              bankName: transferRecipient.bankName,
            },
      extraRows,
    });
  };

  const getActivityVisual = (type: string) => {
    switch (type) {
      case "deposit":
        return {
          icon: ArrowDownLeft,
          tileClass: "bg-accent text-primary",
          isCredit: true,
        };
      case "refund":
        return {
          icon: RefreshCw,
          tileClass: "bg-accent text-primary",
          isCredit: true,
        };
      case "contribution":
        return {
          icon: Users,
          tileClass: "bg-primary/12 text-primary",
          isCredit: false,
        };
      case "vote":
        return {
          icon: VoteIcon,
          tileClass: "bg-secondary text-secondary-foreground",
          isCredit: false,
        };
      default:
        return {
          icon: ArrowUpRight,
          tileClass: "bg-muted text-foreground",
          isCredit: false,
        };
    }
  };

  return (
    <div className="min-h-screen">
      <Header mobilePanel />

      <main className="app-page app-panel-page desktop-panel-wide max-w-4xl">
        {/* Deep-Emerald Native Activity Summary Hero */}
        <section className="app-panel-hero" aria-labelledby="activity-title">
          <p className="panel-kicker text-xs font-semibold uppercase tracking-[0.11em]">
            Ledger & Receipts
          </p>
          <h1 id="activity-title" className="app-page-title mt-1">
            Activity
          </h1>
          <p className="panel-kicker mt-1 text-sm">
            Every transfer, group contribution, and refund — tap any entry for a verified receipt.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2.5 rounded-2xl border border-white/12 bg-white/[0.07] p-3.5 sm:gap-4 sm:p-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#b9decb]">Money in</p>
              <p className="mt-0.5 truncate text-base font-bold text-[#dbf5b4] tabular-nums sm:text-xl">
                +₦{summary.totalIn.toLocaleString()}
              </p>
            </div>
            <div className="min-w-0 border-x border-white/12 px-2.5 sm:px-4">
              <p className="text-[11px] font-medium text-[#b9decb]">Money out</p>
              <p className="mt-0.5 truncate text-base font-bold text-white tabular-nums sm:text-xl">
                ₦{summary.totalOut.toLocaleString()}
              </p>
            </div>
            <div className="min-w-0 pl-1 sm:pl-2">
              <p className="text-[11px] font-medium text-[#b9decb]">Entries</p>
              <p className="mt-0.5 text-base font-bold text-white tabular-nums sm:text-xl">
                {summary.count}
              </p>
            </div>
          </div>
        </section>

        <div className="app-panel-body space-y-4">
          {/* Search + Segmented Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by group, bank, recipient, or reference…"
                aria-label="Search activity"
                className="h-11 rounded-xl pl-10"
              />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActivityFilter)}>
              <TabsList
                className="app-segmented grid w-full grid-cols-5"
                aria-label="Filter activity"
              >
                <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                <TabsTrigger value="in" className="text-xs sm:text-sm">In</TabsTrigger>
                <TabsTrigger value="out" className="text-xs sm:text-sm">Out</TabsTrigger>
                <TabsTrigger value="groups" className="text-xs sm:text-sm">Groups</TabsTrigger>
                <TabsTrigger value="votes" className="text-xs sm:text-sm">Votes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Grouped Timeline List */}
          {groupedByDate.length === 0 ? (
            <Card className="rounded-[1.35rem] p-10 text-center shadow-sm">
              <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold tracking-tight">No activity yet</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {searchQuery
                  ? "No transactions match your search."
                  : "Deposits, transfers, and group contributions will appear here with downloadable receipts."}
              </p>
              {!searchQuery && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button asChild className="h-10 rounded-xl">
                    <Link to="/all-groups">View my groups</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <Link to="/transfer">Send money</Link>
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map((bucket) => (
                <section key={bucket.label} aria-label={bucket.label}>
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {bucket.label}
                  </h2>
                  <Card className="overflow-hidden rounded-[1.35rem] shadow-sm">
                    <div className="divide-y divide-border/70">
                      {bucket.items.map((tx) => {
                        const group = contributions.find((c) => c.id === tx.contribution_id);
                        const meta = (tx.metadata || {}) as Record<string, any>;
                        const { icon: RowIcon, tileClass, isCredit } = getActivityVisual(tx.type);
                        const d = new Date(tx.created_at);
                        const timeLabel = isValid(d) ? format(d, "h:mm a") : "";
                        const statusKey = String(tx.status || "completed").toLowerCase();
                        const canOpenReceipt = tx.type !== "vote";
                        const depositSender = getDepositSender(meta);
                        const transferRecipient = getTransferRecipient(meta);
                        const senderSummary = [depositSender.name, depositSender.bankName]
                          .filter(Boolean)
                          .join(" • ");
                        const recipientSummary = [transferRecipient.name, transferRecipient.bankName]
                          .filter(Boolean)
                          .join(" • ");
                        const subtitle =
                          group?.name ||
                          (tx.type === "transfer" || tx.type === "withdrawal"
                            ? recipientSummary
                            : tx.type === "deposit"
                            ? senderSummary
                            : "") ||
                          tx.description ||
                          (depositSender.bankName ? `Via ${depositSender.bankName}` : "");

                        return (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() => openReceiptForTx(tx)}
                            disabled={!canOpenReceipt}
                            className={cn(
                              "group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors sm:px-5",
                              canOpenReceipt
                                ? "cursor-pointer hover:bg-muted/45 focus-visible:bg-muted focus-visible:outline-none"
                                : "cursor-default"
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                                tileClass
                              )}
                            >
                              <RowIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {titleMap[tx.type] || "Transaction"}
                                </span>
                                {tx.status && statusKey !== "completed" && statusKey !== "successful" && (
                                  <span
                                    className={cn(
                                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                                      statusPillStyles[statusKey] || "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {tx.status}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {subtitle ? `${subtitle} • ${timeLabel}` : timeLabel}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <div className="text-right">
                                <p
                                  className={cn(
                                    "text-sm font-bold tabular-nums",
                                    isCredit ? "text-primary" : "text-foreground"
                                  )}
                                >
                                  {tx.type === "vote"
                                    ? `₦${Number(tx.amount || 0).toLocaleString()}`
                                    : `${isCredit ? "+" : "-"}₦${Number(tx.amount || 0).toLocaleString()}`}
                                </p>
                                {canOpenReceipt && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
                                    <Receipt className="h-3 w-3" />
                                    Receipt
                                  </span>
                                )}
                              </div>
                              {canOpenReceipt && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bank-Grade Native Receipt Dialog (Sender & Group Receipts) */}
      <Dialog
        open={Boolean(selectedReceipt)}
        onOpenChange={(open) => {
          if (!open) setSelectedReceipt(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction Receipt</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <CollectiPayReceipt
              data={selectedReceipt}
              onDone={() => setSelectedReceipt(null)}
              doneLabel="Close receipt"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityHistory;
