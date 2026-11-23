import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  HelpCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId } from "@/data/faqData";
import { cn } from "@/lib/utils";

const categoryLabels: Record<FaqCategoryId, string> = {
  "getting-started": "Getting Started",
  groups: "Groups & Pools",
  voting: "Voting & Refunds",
  "transfers-fees": "Transfers & Fees",
  "ice-vault": "Ice Vault",
  security: "Security & Receipts",
};

export default function Faq() {
  const { isAuthenticated } = useSupabaseUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | FaqCategoryId>("all");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    [FAQ_ITEMS[0].id]: true,
  });

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, searchQuery]);

  const autoExpandSearch = searchQuery.trim().length >= 2 && filteredItems.length <= 3;

  const isItemOpen = (id: string) =>
    id in openIds ? Boolean(openIds[id]) : autoExpandSearch;

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !(id in prev ? prev[id] : autoExpandSearch) }));
  };

  const allVisibleOpen =
    filteredItems.length > 0 && filteredItems.every((item) => isItemOpen(item.id));

  const toggleExpandAll = () => {
    const nextState = !allVisibleOpen;
    setOpenIds((prev) => {
      const updated = { ...prev };
      for (const item of filteredItems) updated[item.id] = nextState;
      return updated;
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      {isAuthenticated ? (
        <Header mobilePanel />
      ) : (
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex min-h-[3.875rem] max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link to="/" className="app-brand">
              <CollectiPayMark size={32} />
              <span>CollectiPay</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/discover">Discover</Link>
              </Button>
              <Button asChild size="sm" className="rounded-xl font-semibold">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto max-w-4xl px-4 pb-16 sm:px-6",
          isAuthenticated
            ? "app-page app-panel-page"
            : "app-panel-page !pt-0 sm:!pt-8"
        )}
      >
        <section className="app-panel-hero" aria-labelledby="faq-page-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="ghost" className="app-panel-secondary gap-1.5 rounded-xl">
              <Link to={isAuthenticated ? "/dashboard" : "/"}>
                <ArrowLeft size={16} aria-hidden="true" />
                {isAuthenticated ? "Back to overview" : "Back to home"}
              </Link>
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#dbf5b4]">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Help &amp; FAQ
            </span>
          </div>

          <h1 id="faq-page-title" className="app-page-title mt-4">
            Frequently Asked Questions
          </h1>
          <p className="panel-kicker mt-1.5 max-w-2xl text-sm">
            Find answers about your wallet, bulk transfers, Ice Vault, group voting, and payments.
          </p>

          <div className="relative mt-5">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b9decb]"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions (e.g., voting, BVN, fees, failed transfer, PIN)…"
              aria-label="Search frequently asked questions"
              className="h-12 rounded-xl border-white/15 bg-white/10 pl-10 pr-10 text-white placeholder:text-[#b9decb]/80 focus-visible:ring-[#dbf5b4]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#d9f3e4] transition-colors hover:bg-white/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        <div className="app-panel-body space-y-5">
          {/* Category Filter Chips + Expand Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filter FAQ by category"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  activeCategory === "all"
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                All ({FAQ_ITEMS.length})
              </button>
              {FAQ_CATEGORIES.map((category) => {
                const count = FAQ_ITEMS.filter((i) => i.category === category.id).length;
                const active = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {category.label} ({count})
                  </button>
                );
              })}
            </div>

            {filteredItems.length > 1 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                {allVisibleOpen ? "Collapse all" : "Expand all"}
              </button>
            )}
          </div>

          {/* Accordion List */}
          {filteredItems.length === 0 ? (
            <div className="cp-card-native p-10 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold">No matching questions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try searching with simpler keywords like “BVN”, “voting”, “transfer”, or “refund”.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const isOpen = isItemOpen(item.id);
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "cp-card-native overflow-hidden transition-colors",
                      isOpen && "border-primary/35"
                    )}
                  >
                    <h2>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`faq-answer-${item.id}`}
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                      >
                        <div className="min-w-0 space-y-1">
                          <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                            {categoryLabels[item.category]}
                          </span>
                          <span className="block text-sm font-bold leading-snug text-foreground sm:text-base">
                            {item.question}
                          </span>
                        </div>
                        <ChevronDown
                          size={18}
                          aria-hidden="true"
                          className={cn(
                            "mt-1 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
                            isOpen && "rotate-180 text-primary"
                          )}
                        />
                      </button>
                    </h2>
                    <div
                      id={`faq-answer-${item.id}`}
                      aria-hidden={!isOpen}
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="border-t border-border/60 px-5 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Action Footer Card */}
          <div className="cp-card-native flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Still need help?
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {isAuthenticated
                  ? "Open a ticket and follow replies from CollectiPay support."
                  : "Sign in to open a support ticket for your account or a payment."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAuthenticated ? (
                <>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/settings">Account settings</Link>
                  </Button>
                  <Button asChild className="gap-1.5 rounded-xl font-semibold">
                    <Link to="/support">
                      Support tickets <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to="/discover">Explore groups</Link>
                  </Button>
                  <Button asChild className="gap-1.5 rounded-xl font-semibold">
                    <Link to="/auth">
                      Sign in for support <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
