import { useEffect, useState } from "react";
import { Building2, Check, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BankMonogram } from "@/components/wallet/BeneficiariesPanel";
import { cn } from "@/lib/utils";
import type { BankOption } from "@/services/supabase/beneficiaryService";

const POPULAR_BANK_KEYWORDS = [
  "opay",
  "palmpay",
  "kuda",
  "moniepoint",
  "guaranty trust",
  "access bank",
  "zenith bank",
  "united bank for africa",
  "first bank",
];

export function BankPicker({
  bank,
  banks,
  isError,
  isFetching,
  onRetry,
  onSelect,
  disabled,
}: {
  bank: BankOption | null;
  banks: BankOption[] | undefined;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  onSelect: (bank: BankOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileViewport, setMobileViewport] = useState<{ height: number; top: number } | null>(null);
  const error = isError && !banks && !isFetching;

  // Keep the mobile bank picker sheet fully visible above the soft keyboard via visualViewport
  useEffect(() => {
    if (!open || typeof window === "undefined") {
      setMobileViewport(null);
      return;
    }

    const updateViewport = () => {
      if (window.innerWidth >= 640) {
        setMobileViewport(null);
        return;
      }
      const vv = window.visualViewport;
      const height = vv ? Math.round(vv.height) : window.innerHeight;
      const top = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
      setMobileViewport({ height, top });
    };

    updateViewport();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateViewport);
    vv?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      vv?.removeEventListener("resize", updateViewport);
      vv?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [open]);

  const query = search.trim().toLowerCase();
  const choices = open ? banks?.filter(({ name }) => name.toLowerCase().includes(query)) : undefined;
  const popularBanks =
    open && !query && banks
      ? POPULAR_BANK_KEYWORDS.map((kw) =>
          banks.find((b) => b.name.toLowerCase().includes(kw))
        ).filter(
          (b, idx, arr): b is BankOption =>
            Boolean(b) && arr.findIndex((x) => x?.code === b?.code) === idx
        )
      : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          disabled={disabled}
          variant="outline"
          className="h-12 w-full justify-between gap-2 rounded-xl px-3 font-medium"
          aria-label={bank ? `Bank, ${bank.name}` : "Select bank"}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {bank ? (
              <BankMonogram bankName={bank.name} size="sm" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <Building2 size={16} aria-hidden="true" />
              </span>
            )}
            <span className={cn("truncate", !bank && "text-muted-foreground")}>
              {bank?.name || "Select bank"}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          if (typeof window !== "undefined" && window.innerWidth < 640) {
            event.preventDefault();
          }
        }}
        style={
          mobileViewport
            ? {
                top: `${mobileViewport.top}px`,
                maxHeight: `${Math.max(240, mobileViewport.height - 8)}px`,
                height: `${Math.min(Math.max(260, mobileViewport.height - 8), 580)}px`,
              }
            : undefined
        }
        className="inset-x-0 bottom-auto top-0 flex flex-col gap-3 overflow-hidden rounded-b-3xl rounded-t-none p-4 pt-[max(1rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(85dvh,36rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-[state=closed]:slide-out-to-top-0 sm:data-[state=open]:slide-in-from-top-0"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Choose a bank</DialogTitle>
          <DialogDescription>Select or search the recipient’s Nigerian bank.</DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search banks"
            className="h-11 rounded-xl pl-9 pr-9"
            placeholder="Search bank name (e.g. OPay, Moniepoint, GTBank)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear bank search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {popularBanks.length > 0 && (
          <div className="shrink-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Popular banks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {popularBanks.slice(0, 6).map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  onClick={() => {
                    onSelect(choice);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    choice.code === bank?.code
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-accent"
                  )}
                >
                  {choice.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <p role="alert">Couldn’t load banks.</p>
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : choices ? (
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain rounded-xl border sm:max-h-[22rem]">
            {choices.map((choice) => (
              <li key={choice.code}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:bg-muted"
                  onClick={() => {
                    onSelect(choice);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <BankMonogram bankName={choice.name} size="sm" />
                    <span className="truncate font-medium">{choice.name}</span>
                  </span>
                  {choice.code === bank?.code && (
                    <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
            {choices.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                No banks match “{search.trim()}”.
              </li>
            )}
          </ul>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Loading banks…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
