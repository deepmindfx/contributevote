import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { CATEGORIES } from "@/services/supabase/groupEnhancementService";
import { DiscoverFilters, SortOption } from "@/services/supabase/discoverService";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
  filters: DiscoverFilters;
  sortBy: SortOption;
  onFiltersChange: (filters: DiscoverFilters) => void;
  onSortChange: (sort: SortOption) => void;
}

const QUICK_CATEGORIES = [
  "community",
  "religious",
  "charity",
  "business",
  "education",
  "health",
  "travel",
  "investment",
  "family",
  "event",
  "emergency",
  "housing",
];

const FREQUENCY_CHIPS = [
  { value: "", label: "Any" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one-time", label: "One-time" },
];

const PROGRESS_CHIPS = [
  { value: "", label: "Any progress" },
  { value: "low", label: "0–25%" },
  { value: "medium", label: "25–75%" },
  { value: "high", label: "75–99%" },
  { value: "complete", label: "Funded" },
];

export default function SearchFilters({
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
}: SearchFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [minDraft, setMinDraft] = useState(filters.minAmount ? String(filters.minAmount) : "");
  const [maxDraft, setMaxDraft] = useState(filters.maxAmount ? String(filters.maxAmount) : "");

  useEffect(() => {
    setMinDraft(filters.minAmount ? String(filters.minAmount) : "");
    setMaxDraft(filters.maxAmount ? String(filters.maxAmount) : "");
  }, [filters.minAmount, filters.maxAmount]);

  const setFilter = (key: keyof DiscoverFilters, value: any) => {
    const next = { ...filters, [key]: value || undefined };
    onFiltersChange(next);
  };

  const clearNonSearchFilters = () => {
    onFiltersChange(filters.search ? { search: filters.search } : {});
  };

  const secondaryFilterCount = [
    filters.frequency,
    filters.progress,
    filters.minAmount,
    filters.maxAmount,
  ].filter(Boolean).length;

  const totalActiveFilters = secondaryFilterCount + (filters.category ? 1 : 0);

  const railCategories = CATEGORIES.filter(
    (c) => QUICK_CATEGORIES.includes(c.value) || c.value === filters.category
  );

  return (
    <div className="space-y-3">
      {/* Horizontal Category Pill Rail */}
      <div
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Filter groups by category"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!filters.category}
          onClick={() => setFilter("category", undefined)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all",
            !filters.category
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
          )}
        >
          All pools
        </button>

        {railCategories.map((cat) => {
          const active = filters.category === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter("category", active ? undefined : cat.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
              )}
            >
              <CategoryIcon
                category={cat.value}
                size={14}
                className={active ? "text-primary-foreground" : "text-primary"}
              />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Compact Action Strip: Refine Sheet + Sort + Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl font-semibold">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Refine
                {secondaryFilterCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums">
                    {secondaryFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>

            <SheetContent
              side="bottom"
              className="mx-auto max-h-[88dvh] max-w-xl overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader className="text-left">
                <SheetTitle>Refine public groups</SheetTitle>
                <SheetDescription>
                  Narrow pools by category, schedule, progress, or goal size.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                {/* Full 19 Categories Grid */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilter("category", undefined)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold",
                        !filters.category
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-accent"
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => {
                      const active = filters.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFilter("category", active ? undefined : cat.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          <CategoryIcon
                            category={cat.value}
                            size={13}
                            className={active ? "text-primary-foreground" : "text-primary"}
                          />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frequency Chips */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contribution Frequency
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {FREQUENCY_CHIPS.map((item) => {
                      const active = (filters.frequency || "") === item.value;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setFilter("frequency", item.value || undefined)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Funding Progress Chips */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Funding Progress
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROGRESS_CHIPS.map((item) => {
                      const active = (filters.progress || "") === item.value;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setFilter("progress", item.value || undefined)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Goal Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Target Goal Range (₦)
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Min (e.g. 50,000)"
                      value={minDraft}
                      onChange={(e) => {
                        setMinDraft(e.target.value);
                        setFilter("minAmount", e.target.value ? Number(e.target.value) : undefined);
                      }}
                      className="h-11 rounded-xl tabular-nums"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Max (e.g. 5,000,000)"
                      value={maxDraft}
                      onChange={(e) => {
                        setMaxDraft(e.target.value);
                        setFilter("maxAmount", e.target.value ? Number(e.target.value) : undefined);
                      }}
                      className="h-11 rounded-xl tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearNonSearchFilters}
                    className="h-11 rounded-xl"
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="h-11 rounded-xl font-semibold"
                  >
                    Show pools
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {totalActiveFilters > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearNonSearchFilters}
              className="h-10 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Clean Sort Selector */}
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger
            className="h-10 w-[165px] rounded-xl text-xs font-semibold"
            aria-label="Sort public pools"
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="most_funded">Most funded</SelectItem>
            <SelectItem value="ending_soon">Ending soon</SelectItem>
            <SelectItem value="alphabetical">A to Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
