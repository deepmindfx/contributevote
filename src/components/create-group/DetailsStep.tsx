import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter, CardHeader, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/services/supabase/groupEnhancementService";

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

export function getDetailsError(data: GroupDetails) {
  if (!data.name.trim()) return { field: "group-name", message: "Enter a group name." };
  if (!Number.isFinite(Number(data.targetAmount)) || Number(data.targetAmount) <= 0) {
    return { field: "group-goal", message: "Enter a goal greater than ₦0." };
  }
  if (data.contributionAmount && (!Number.isFinite(Number(data.contributionAmount)) || Number(data.contributionAmount) <= 0)) {
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
  const advanced = useRef<HTMLDetailsElement>(null);

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
    <form onSubmit={handleSubmit} onChange={() => setError(null)} noValidate>
      <CardHeader className="group-form-heading py-4">
        <h2 className="text-xl font-semibold tracking-tight">Set a goal</h2>
        <CardDescription>Give your group a name and a target to save toward.</CardDescription>
      </CardHeader>
      <CardContent className="group-form-fields space-y-4 pb-5">
        <div className="space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input id="group-name" name="group-name" placeholder="e.g. Family travel fund" required value={formData.name} onChange={(event) => handleChange("name", event.target.value)} {...fieldError("group-name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="group-goal">Savings goal (₦)</Label>
            <Input id="group-goal" name="group-goal" type="number" inputMode="decimal" min="0.01" step="any" placeholder="0.00" required value={formData.targetAmount} onChange={(event) => handleChange("targetAmount", event.target.value)} {...fieldError("group-goal")} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="group-amount">Amount per member (₦) <span className="font-normal text-muted-foreground">· Optional</span></Label>
            <Input id="group-amount" name="group-amount" type="number" inputMode="decimal" min="0.01" step="any" placeholder="0.00" value={formData.contributionAmount} onChange={(event) => handleChange("contributionAmount", event.target.value)} {...fieldError("group-amount")} />
          </div>
        </div>

        <details ref={advanced} className="rounded-xl border">
          <summary className="app-disclosure px-3">
            <span>
              <span className="block font-semibold">Schedule and description</span>
              <span className="block text-xs capitalize text-muted-foreground">{formData.frequency} · {formData.startDate || "Starts today"}</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="grid gap-4 border-t p-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="group-frequency">Contribution frequency</Label>
              <select id="group-frequency" className="group-form-select" value={formData.frequency} onChange={(event) => handleChange("frequency", event.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="group-category">Category</Label>
              <select id="group-category" className="group-form-select" value={formData.category} onChange={(event) => handleChange("category", event.target.value)}>
                {CATEGORIES.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="group-start">Start date <span className="font-normal text-muted-foreground">· Optional</span></Label>
              <Input id="group-start" type="date" value={formData.startDate} onChange={(event) => handleChange("startDate", event.target.value)} />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="group-end">End date <span className="font-normal text-muted-foreground">· Optional</span></Label>
              <Input id="group-end" name="group-end" type="date" min={formData.startDate || undefined} value={formData.endDate} onChange={(event) => handleChange("endDate", event.target.value)} {...fieldError("group-end")} />
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <Label htmlFor="group-description">Description or house rules <span className="font-normal text-muted-foreground">· Optional</span></Label>
              <Textarea id="group-description" className="text-base md:text-sm" value={formData.description} onChange={(event) => handleChange("description", event.target.value)} />
            </div>
          </div>
        </details>
        {error && <p id="group-goal-error" role="alert" className="text-sm text-destructive">{error.message}</p>}
      </CardContent>
      <CardFooter className="group-form-actions justify-end">
        <Button type="submit" className="w-full gap-2 sm:w-auto">Continue <ArrowRight size={16} aria-hidden="true" /></Button>
      </CardFooter>
    </form>
  );
}
