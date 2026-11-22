import { CalendarDays } from "lucide-react";
import type { TransferAllowance } from "@/services/supabase/pricingService";

export function TransferAllowanceNotice({ allowance }: { allowance: TransferAllowance }) {
  if (!allowance.friday_free && allowance.daily_limit < 1) return null;
  const { daily_remaining: remaining } = allowance;
  const title = allowance.free_today
    ? "Friday bank transfers are free"
    : remaining > 0
      ? `${remaining} free bank transfer${remaining === 1 ? "" : "s"} left today`
      : allowance.daily_limit > 0 ? "Daily free transfers used" : "Free transfers every Friday";
  return (
    <aside className="flex min-w-0 items-start gap-2.5 rounded-xl bg-accent/55 px-3 py-2.5 text-sm">
      <CalendarDays size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {allowance.free_today ? (
          <p className="text-xs text-muted-foreground">Send to any supported bank for free until midnight Lagos time.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {allowance.friday_free ? "Free every Friday, Lagos time." : "The daily allowance resets at midnight Lagos time."}
            {allowance.daily_limit > 0 && " Standard fees apply after the daily allowance."}
          </p>
        )}
      </div>
    </aside>
  );
}
