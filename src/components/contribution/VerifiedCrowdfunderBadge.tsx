import React from "react";
import { BadgeCheck, Flame, Pin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedCrowdfunderBadgeProps {
  label?: string | null;
  onDark?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const VerifiedCrowdfunderBadge: React.FC<VerifiedCrowdfunderBadgeProps> = ({
  label = "Verified Crowdfunder",
  onDark = false,
  size = "sm",
  className,
}) => {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-bold tracking-tight",
        size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[10.5px]",
        onDark
          ? "border border-[#dbf5b4]/45 bg-[#dbf5b4] text-[#083026] shadow-sm"
          : "border border-emerald-500/30 bg-emerald-500/12 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
        className
      )}
    >
      <BadgeCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      <span>{label || "Verified Crowdfunder"}</span>
    </span>
  );
};

interface SpotlightBadgeProps {
  label?: string | null;
  isPinned?: boolean;
  onDark?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const SpotlightBadge: React.FC<SpotlightBadgeProps> = ({
  label,
  isPinned = false,
  onDark = false,
  size = "sm",
  className,
}) => {
  const display = label?.trim() || (isPinned ? "Most Needed" : "");
  if (!display) return null;

  const isUrgent = /needed|urgent|priority|emergency|critical/i.test(display);
  const Icon = isUrgent ? Flame : isPinned ? Pin : Sparkles;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-extrabold uppercase tracking-wider",
        size === "md" ? "px-3 py-1 text-[11px]" : "px-2.5 py-0.5 text-[10px]",
        onDark
          ? isUrgent
            ? "border border-amber-300/50 bg-amber-400/20 text-amber-100"
            : "border border-white/25 bg-white/15 text-white"
          : isUrgent
          ? "border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200"
          : "border border-primary/25 bg-accent text-primary",
        className
      )}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      <span>{display}</span>
    </span>
  );
};
