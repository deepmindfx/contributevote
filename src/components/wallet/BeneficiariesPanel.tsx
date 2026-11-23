import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock3,
  MoreVertical,
  Pencil,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RecipientNicknameDialog } from "@/components/wallet/RecipientNicknameDialog";
import {
  formatAccountNumberSpaced,
  getBankBadgeStyle,
  type TransferBeneficiary,
} from "@/services/supabase/beneficiaryService";
import { cn } from "@/lib/utils";

interface BeneficiariesPanelProps {
  beneficiaries: TransferBeneficiary[];
  loading: boolean;
  onSelect: (beneficiary: TransferBeneficiary) => void;
  onToggleFavorite: (beneficiary: TransferBeneficiary) => Promise<void>;
  onSaveNickname: (beneficiary: TransferBeneficiary, nickname: string) => Promise<void>;
  onHideRecent: (beneficiary: TransferBeneficiary) => Promise<void>;
}

export function BankMonogram({ bankName, size = "md" }: { bankName?: string | null; size?: "sm" | "md" }) {
  const badge = getBankBadgeStyle(bankName);
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: badge.bg, color: badge.text }}
      className={cn(
        "grid shrink-0 place-items-center font-extrabold tracking-tight shadow-sm",
        size === "sm" ? "h-8 w-8 rounded-lg text-[11px]" : "h-10 w-10 rounded-xl text-xs"
      )}
    >
      {badge.initials}
    </span>
  );
}

export function BeneficiariesPanel({
  beneficiaries,
  loading,
  onSelect,
  onToggleFavorite,
  onSaveNickname,
  onHideRecent,
}: BeneficiariesPanelProps) {
  const [tab, setTab] = useState<"recents" | "favorites">("recents");
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<"recents" | "favorites">("recents");
  const [sheetSearch, setSheetSearch] = useState("");
  const [editing, setEditing] = useState<TransferBeneficiary | null>(null);

  const favorites = useMemo(
    () => beneficiaries.filter((item) => item.favorite),
    [beneficiaries]
  );

  const filterList = (list: TransferBeneficiary[], query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.accountName.toLowerCase().includes(q) ||
        (item.nickname && item.nickname.toLowerCase().includes(q)) ||
        item.accountNumber.includes(q.replace(/\s+/g, "")) ||
        item.bankName.toLowerCase().includes(q)
    );
  };

  const inlineBase = tab === "favorites" ? favorites : beneficiaries;
  const inlineFiltered = useMemo(
    () => filterList(inlineBase, searchQuery),
    [inlineBase, searchQuery]
  );
  const visiblePreview = inlineSearchOpen ? inlineFiltered.slice(0, 8) : inlineFiltered.slice(0, 3);

  const sheetBase = sheetTab === "favorites" ? favorites : beneficiaries;
  const sheetFiltered = useMemo(
    () => filterList(sheetBase, sheetSearch),
    [sheetBase, sheetSearch]
  );

  const openNicknameEditor = (item: TransferBeneficiary) => {
    // Close the full beneficiaries sheet before opening the nickname dialog so two Radix modals never stack
    setAllOpen(false);
    setEditing(item);
  };

  const renderRow = (item: TransferBeneficiary, compact = false) => {
    const displayName = item.nickname || item.accountName;
    const secondaryName = item.nickname ? item.accountName : null;
    return (
      <div
        key={item.key}
        className="group flex items-center gap-2.5 py-2.5 transition-colors first:pt-1 last:pb-1"
      >
        <button
          type="button"
          onClick={() => {
            setAllOpen(false);
            onSelect(item);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BankMonogram bankName={item.bankName} size={compact ? "sm" : "md"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-bold text-foreground">
                {displayName}
              </span>
              {item.favorite && (
                <Star
                  size={12}
                  className="shrink-0 fill-amber-400 text-amber-400"
                  aria-label="Favorite recipient"
                />
              )}
              {item.isOwnAccount && (
                <span className="shrink-0 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Own Account
                </span>
              )}
            </div>
            {secondaryName && (
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {secondaryName}
              </p>
            )}
            <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
              {formatAccountNumberSpaced(item.accountNumber)} · {item.bankName}
            </p>
          </div>
          <ChevronRight
            size={16}
            className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Manage ${displayName}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreVertical size={15} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            <DropdownMenuItem onClick={() => void onToggleFavorite(item)} className="gap-2">
              <Star
                size={14}
                className={item.favorite ? "fill-amber-400 text-amber-400" : undefined}
              />
              {item.favorite ? "Remove favorite" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openNicknameEditor(item)} className="gap-2">
              <Pencil size={14} />
              {item.nickname ? "Edit nickname" : "Set nickname"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void onHideRecent(item)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 size={14} />
              Remove from list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <>
      <Card className="cp-card-native overflow-hidden p-4 sm:p-5">
        {/* Header Tabs + Inline Search Trigger */}
        <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-4" role="tablist" aria-label="Saved transfer recipients">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "recents"}
              onClick={() => setTab("recents")}
              className={cn(
                "relative pb-1 text-sm font-bold transition-colors",
                tab === "recents" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Recents
              {tab === "recents" && (
                <span className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-primary" />
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "favorites"}
              onClick={() => setTab("favorites")}
              className={cn(
                "relative inline-flex items-center gap-1 pb-1 text-sm font-bold transition-colors",
                tab === "favorites" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Favorites
              {favorites.length > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground tabular-nums">
                  {favorites.length}
                </span>
              )}
              {tab === "favorites" && (
                <span className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          <button
            type="button"
            aria-label={inlineSearchOpen ? "Close recipient search" : "Search recipients"}
            onClick={() => {
              setInlineSearchOpen((prev) => !prev);
              if (inlineSearchOpen) setSearchQuery("");
            }}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full transition-colors",
              inlineSearchOpen
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {inlineSearchOpen ? <X size={15} /> : <Search size={16} />}
          </button>
        </div>

        {/* Optional Inline Search Input */}
        {inlineSearchOpen && (
          <div className="relative mt-3">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, bank, or account number…"
              aria-label="Search recent recipients"
              className="h-10 rounded-xl pl-9 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* List Body */}
        <div className="mt-2">
          {loading ? (
            <div className="space-y-3 py-2">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-48 animate-pulse rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : visiblePreview.length === 0 ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                {tab === "favorites" ? <Star size={18} /> : <Clock3 size={18} />}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {searchQuery
                  ? "No matching recipients"
                  : tab === "favorites"
                  ? "No favorite recipients yet"
                  : "No recent transfers yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {searchQuery
                  ? "Try a different name, bank, or account number."
                  : tab === "favorites"
                  ? "Star anyone from Recents to pin them here for 1-tap transfers."
                  : "People you send money to will show up here for instant 1-tap transfers."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visiblePreview.map((item) => renderRow(item, true))}
            </div>
          )}
        </div>

        {/* View All CTA */}
        {!loading && beneficiaries.length > 3 && (
          <div className="mt-3 flex justify-center border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => {
                setSheetTab(tab);
                setSheetSearch("");
                setAllOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-4 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-accent hover:text-primary"
            >
              View All ({beneficiaries.length})
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </Card>

      {/* Full Beneficiaries Sheet Dialog */}
      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent
          onOpenAutoFocus={(event) => {
            if (typeof window !== "undefined" && window.innerWidth < 640) {
              event.preventDefault();
            }
          }}
          className="inset-x-0 bottom-auto top-0 flex max-h-[82dvh] w-full flex-col gap-3 overflow-hidden rounded-b-3xl rounded-t-none p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-5"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users size={18} className="text-primary" aria-hidden="true" />
              Beneficiaries
            </DialogTitle>
            <DialogDescription>
              Tap anyone to send money immediately without re-entering their bank details.
            </DialogDescription>
          </DialogHeader>

          <div className="relative shrink-0">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={sheetSearch}
              onChange={(e) => setSheetSearch(e.target.value)}
              placeholder="Account number, name, or bank"
              aria-label="Search all beneficiaries"
              className="h-11 rounded-xl pl-10 pr-9"
            />
            {sheetSearch && (
              <button
                type="button"
                onClick={() => setSheetSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid shrink-0 grid-cols-2 rounded-xl bg-muted/60 p-1">
            {(["recents", "favorites"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSheetTab(key)}
                className={cn(
                  "rounded-lg py-2 text-xs font-bold transition-colors",
                  sheetTab === key
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === "recents"
                  ? `Recents (${beneficiaries.length})`
                  : `Favorites (${favorites.length})`}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            {sheetFiltered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No beneficiaries match your filter.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {sheetFiltered.map((item) => renderRow(item))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editing && (
        <RecipientNicknameDialog
          accountName={editing.accountName}
          initialNickname={editing.nickname}
          onClose={() => setEditing(null)}
          onSave={(nickname) => onSaveNickname(editing, nickname)}
        />
      )}
    </>
  );
}
