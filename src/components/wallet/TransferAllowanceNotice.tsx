import { CalendarDays } from "lucide-react";
import type { TransferAllowance } from "@/services/supabase/pricingService";

export function TransferAllowanceNotice({ allowance }: { allowance: TransferAllowance }) {
  if (allowance.fees_enabled === false) {
    return <aside className="rounded-xl bg-accent/55 px-3 py-2.5 text-sm font-semibold">No CollectiPay bank transfer fees</aside>;
  }
  if (!allowance.friday_free && allowance.daily_limit < 1) return null;
  const { daily_remaining: remaining } = allowance;
  const title = allowance.free_today
    ? "Free bank transfers today"
    : remaining > 0
      ? `${remaining} free bank transfer${remaining === 1 ? "" : "s"} left today`
      : allowance.daily_limit > 0 ? "Daily free transfers used" : "Free transfers every Friday";
  return (
    <aside className="flex min-w-0 items-start gap-2.5 rounded-xl bg-accent/55 px-3 py-2.5 text-sm">
      <CalendarDays size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {allowance.free_today ? (
          <p className="text-xs text-muted-foreground">Send to any supported bank for free every Friday.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {allowance.friday_free && allowance.daily_limit > 0 && "Free every Friday. "}
            {allowance.daily_limit > 0 ? "Fees apply after your daily allowance." : "Standard fees apply on other days."}
          </p>
        )}
      </div>
    </aside>
  );
}
