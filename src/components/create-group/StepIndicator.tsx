import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = ["Goal", "Settings"];

export default function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label="Group setup progress">
      {steps.map((label, index) => {
        const completed = index + 1 < currentStep;
        const active = index + 1 === currentStep;

        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted-foreground sm:px-3",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabular-nums", active || completed ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {completed ? <Check size={13} aria-label="Complete" /> : index + 1}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
