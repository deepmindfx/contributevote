import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock,
  Grid2x2,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter, CardHeader, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { CATEGORIES, getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { cn } from "@/lib/utils";

export type GroupDetails = {
  name: string;
  targetAmount: string;
  contributionAmount: string;
  description: string;
  category: string;
  frequency: string;
  startDate: string;
  endDate: string;
};

const GOAL_PRESETS = [
  { label: "₦50k", value: "50000" },
  { label: "₦100k", value: "100000" },
  { label: "₦250k", value: "250000" },
  { label: "₦500k", value: "500000" },
  { label: "₦1M", value: "1000000" },
];

const FREQUENCY_OPTIONS = [
  {
    value: "daily",
    label: "Daily",
    detail: "Every day",
    icon: Sun,
  },
  {
    value: "weekly",
    label: "Weekly",
    detail: "Once a week",
    icon: CalendarDays,
  },
  {
    value: "monthly",
    label: "Monthly",
    detail: "Once a month",
    icon: CalendarRange,
  },
  {
    value: "one-time",
    label: "One-time",
    detail: "Flexible lump sum",
    icon: Sparkles,
  },
] as const;

const FEATURED_CATEGORY_VALUES = [
  "personal",
  "family",
  "community",
  "business",
  "event",
  "travel",
  "investment",
  "emergency",
];

function addDaysToIso(baseDate: string, days: number) {
  const base = baseDate ? new Date(baseDate + "T00:00:00") : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getDetailsError(data: GroupDetails) {
  if (!data.name.trim()) return { field: "group-name", message: "Enter a group name." };
  if (!Number.isFinite(Number(data.targetAmount)) || Number(data.targetAmount) <= 0) {
    return { field: "group-goal", message: "Enter a goal greater than ₦0." };
  }
  if (
    data.contributionAmount &&
    (!Number.isFinite(Number(data.contributionAmount)) || Number(data.contributionAmount) <= 0)
  ) {
    return { field: "group-amount", message: "Enter an amount greater than ₦0, or leave this blank." };
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return { field: "group-end", message: "Choose an end date on or after the start date." };
  }
  return null;
}

interface DetailsStepProps {
  formData: GroupDetails;
  handleChange: (field: keyof GroupDetails, value: string) => void;
  onContinue: () => void;
}

export default function DetailsStep({ formData, handleChange, onContinue }: DetailsStepProps) {
  const [error, setError] = useState<ReturnType<typeof getDetailsError>>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const advanced = useRef<HTMLDetailsElement>(null);

  const visibleCategories = useMemo(() => {
    const featured = CATEGORIES.filter((c) => FEATURED_CATEGORY_VALUES.includes(c.value));
    const alreadyVisible = featured.some((c) => c.value === formData.category);
    if (alreadyVisible) return featured;
    const selected = CATEGORIES.find((c) => c.value === formData.category);
    if (!selected) return featured;
    return [selected, ...featured.slice(0, 7)];
  }, [formData.category]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
    );
  }, [categoryQuery]);

  const numericGoal = Number(formData.targetAmount);
  const formattedGoal =
    Number.isFinite(numericGoal) && numericGoal > 0
      ? `₦${numericGoal.toLocaleString("en-NG")}`
      : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError = getDetailsError(formData);
    setError(nextError);
    if (!nextError) {
      onContinue();
      return;
    }
    if (nextError.field === "group-end" && advanced.current) advanced.current.open = true;
    const field = event.currentTarget.elements.namedItem(nextError.field);
    if (field instanceof HTMLElement) field.focus();
  };

  const fieldError = (id: string) => ({
    "aria-invalid": error?.field === id,
    "aria-describedby": error?.field === id ? "group-goal-error" : undefined,
  });

  return (
    <>
      <form onSubmit={handleSubmit} onChange={() => setError(null)} noValidate>
        <CardHeader className="group-form-heading pb-3 pt-5">
          <h2 className="text-xl font-bold tracking-tight">Design your group pool</h2>
          <CardDescription>
            Choose a clear name, savings target, category, and contribution rhythm.
          </CardDescription>
        </CardHeader>

        <CardContent className="group-form-fields space-y-6 pb-6">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-sm font-semibold">
              Group name
            </Label>
            <Input
              id="group-name"
              name="group-name"
              placeholder="e.g. December Detty Travel Pool"
              required
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              className="h-12 rounded-xl text-base md:text-sm"
              {...fieldError("group-name")}
            />
          </div>

          {/* Savings Goal + Quick Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="group-goal" className="text-sm font-semibold">
                Savings goal
              </Label>
              {formattedGoal && (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
                  {formattedGoal}
                </span>
              )}
            </div>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-primary"
              >
                ₦
              </span>
              <Input
                id="group-goal"
                name="group-goal"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                placeholder="250000"
                required
                value={formData.targetAmount}
                onChange={(event) => handleChange("targetAmount", event.target.value)}
                className="h-12 rounded-xl pl-9 text-base font-semibold tabular-nums"
                {...fieldError("group-goal")}
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick goal amounts">
              {GOAL_PRESETS.map((preset) => {
                const isSelected = formData.targetAmount === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setError(null);
                      handleChange("targetAmount", preset.value);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Native Contribution Frequency Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Contribution frequency</Label>
              <span className="text-xs font-medium capitalize text-muted-foreground">
                {formData.frequency}
              </span>
            </div>
            <div
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Contribution frequency"
            >
              {FREQUENCY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = formData.frequency === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-selected={selected}
                    onClick={() => handleChange("frequency", option.value)}
                    className="cp-tile-option flex flex-col items-start gap-2 p-3 text-left"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-lg",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {selected && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-bold leading-tight text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                        {option.detail}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Native Category Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Category</Label>
              <button
                type="button"
                onClick={() => {
                  setCategoryQuery("");
                  setCategorySheetOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-primary hover:bg-accent/80"
              >
                <Grid2x2 className="h-3.5 w-3.5" aria-hidden="true" />
                All {CATEGORIES.length} categories
              </button>
            </div>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Group category"
            >
              {visibleCategories.map((cat) => {
                const selected = formData.category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-selected={selected}
                    onClick={() => handleChange("category", cat.value)}
                    className="cp-tile-option flex items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <CategoryIcon category={cat.value} size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expandable Schedule, Suggested Share & Rules */}
          <details ref={advanced} className="overflow-hidden rounded-2xl border bg-muted/20">
            <summary className="app-disclosure px-4">
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-foreground">
                    Per-member amount, timeline &amp; rules
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Optional ·{" "}
                    {formData.contributionAmount
                      ? `₦${Number(formData.contributionAmount).toLocaleString()} / member`
                      : "Flexible amounts"}{" "}
                    · {formData.endDate ? `Ends ${formData.endDate}` : "Open-ended"}
                  </span>
                </span>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>

            <div className="space-y-4 border-t bg-card p-4">
              <div className="space-y-2">
                <Label htmlFor="group-amount" className="text-sm font-semibold">
                  Suggested amount per member (₦){" "}
                  <span className="font-normal text-muted-foreground">· Optional</span>
                </Label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground"
                  >
                    ₦
                  </span>
                  <Input
                    id="group-amount"
                    name="group-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 25000"
                    value={formData.contributionAmount}
                    onChange={(event) => handleChange("contributionAmount", event.target.value)}
                    className="h-11 rounded-xl pl-8 tabular-nums"
                    {...fieldError("group-amount")}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="group-start" className="text-sm font-semibold">
                    Start date <span className="font-normal text-muted-foreground">· Optional</span>
                  </Label>
                  <Input
                    id="group-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) => handleChange("startDate", event.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="group-end" className="text-sm font-semibold">
                    Target date <span className="font-normal text-muted-foreground">· Optional</span>
                  </Label>
                  <Input
                    id="group-end"
                    name="group-end"
                    type="date"
                    min={formData.startDate || undefined}
                    value={formData.endDate}
                    onChange={(event) => handleChange("endDate", event.target.value)}
                    className="h-11 rounded-xl"
                    {...fieldError("group-end")}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                  Quick target:
                </span>
                {[
                  { label: "+30 days", days: 30 },
                  { label: "+90 days", days: 90 },
                  { label: "+6 months", days: 180 },
                  { label: "+1 year", days: 365 },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => handleChange("endDate", addDaysToIso(formData.startDate, d.days))}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-primary"
                  >
                    {d.label}
                  </button>
                ))}
                {formData.endDate && (
                  <button
                    type="button"
                    onClick={() => handleChange("endDate", "")}
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-description" className="text-sm font-semibold">
                  Description or house rules{" "}
                  <span className="font-normal text-muted-foreground">· Optional</span>
                </Label>
                <Textarea
                  id="group-description"
                  rows={3}
                  placeholder="Share contribution expectations, payout goals, or deadlines for members..."
                  className="rounded-xl text-base md:text-sm"
                  value={formData.description}
                  onChange={(event) => handleChange("description", event.target.value)}
                />
              </div>
            </div>
          </details>

          {error && (
            <p
              id="group-goal-error"
              role="alert"
              className="rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
            >
              {error.message}
            </p>
          )}
        </CardContent>

        <CardFooter className="group-form-actions flex items-center justify-between gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary">
              <CategoryIcon category={formData.category} size={14} />
            </span>
            <span>
              <strong className="text-foreground">{getCategoryLabel(formData.category)}</strong> ·{" "}
              <span className="capitalize">{formData.frequency}</span>
            </span>
          </div>
          <Button type="submit" className="h-12 w-full gap-2 rounded-xl font-semibold sm:w-auto sm:px-6">
            Continue to settings <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </CardFooter>
      </form>

      {/* Full Native Category Picker Sheet */}
      <Dialog open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="border-b bg-muted/30 px-5 pb-4 pt-5">
            <DialogTitle>Choose group category</DialogTitle>
            <DialogDescription>
              Categorizing helps members understand your pool at a glance.
            </DialogDescription>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Search categories (e.g. Wedding, Housing, Business)..."
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </DialogHeader>
          <div className="grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
            {filteredCategories.map((cat) => {
              const selected = formData.category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  data-selected={selected}
                  onClick={() => {
                    handleChange("category", cat.value);
                    setCategorySheetOpen(false);
                  }}
                  className="cp-tile-option flex items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-primary"
                    )}
                  >
                    <CategoryIcon category={cat.value} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                    {cat.label}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
            {filteredCategories.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No categories match "{categoryQuery}".
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
