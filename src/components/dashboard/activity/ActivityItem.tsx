import { ArrowDownLeft, ArrowUpRight, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityItemProps {
  type: "deposit" | "withdrawal" | "vote";
  title: string;
  description: string;
  amount: string;
  date: string;
  status?: "pending" | "completed" | "rejected" | "failed";
  senderDetails?: string | null;
}

const icons = { deposit: ArrowDownLeft, withdrawal: ArrowUpRight, vote: Vote };
const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  completed: "bg-accent text-accent-foreground",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export default function ActivityItem({ type, title, description, amount, date, status, senderDetails }: ActivityItemProps) {
  const Icon = icons[type];

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)] items-start gap-3 border-b py-3.5 last:border-b-0 sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h4 className="break-words text-sm font-semibold">{title}</h4>
        {description && <p className="mt-0.5 break-words text-xs text-muted-foreground">{description}</p>}
        {senderDetails && <p className="mt-0.5 break-words text-xs text-muted-foreground">{senderDetails}</p>}
        {status && <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium capitalize", statusStyles[status])}>{status}</span>}
      </div>
      <div className="min-w-0 text-right">
        <p className={cn("break-words text-sm font-semibold tabular-nums", type === "deposit" && "text-primary")}>{amount}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}
