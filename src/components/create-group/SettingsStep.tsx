import type { FormEvent } from "react";
import { CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type GroupSettings = {
  privacy: "public" | "private";
  enableVotingRights: boolean;
};

interface SettingsStepProps {
  formData: GroupSettings;
  onPrivacyChange: (privacy: GroupSettings["privacy"]) => void;
  onVotingChange: (enabled: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
}

export default function SettingsStep({ formData, onPrivacyChange, onVotingChange, onBack, onSubmit, pending }: SettingsStepProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardHeader className="group-form-heading py-4">
        <h2 className="text-xl font-semibold tracking-tight">Choose your settings</h2>
        <CardDescription>Decide who can join and who approves withdrawals.</CardDescription>
      </CardHeader>
      <CardContent className="group-form-fields space-y-5 pb-5">
        <div className="space-y-2">
          <p id="group-privacy-label" className="text-sm font-semibold">Who can join?</p>
          <RadioGroup className="grid gap-2 sm:grid-cols-2" aria-labelledby="group-privacy-label" value={formData.privacy} onValueChange={onPrivacyChange}>
            <Label htmlFor="group-public" className="group-form-choice">
              <RadioGroupItem id="group-public" value="public" className="mt-0.5 shrink-0" />
              <span><strong className="block">Public</strong><span className="text-muted-foreground">Anyone can find and join.</span></span>
            </Label>
            <Label htmlFor="group-private" className="group-form-choice">
              <RadioGroupItem id="group-private" value="private" className="mt-0.5 shrink-0" />
              <span><strong className="block">Private</strong><span className="text-muted-foreground">People you invite.</span></span>
            </Label>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <p id="group-approval-label" className="text-sm font-semibold">Who approves withdrawals?</p>
          <RadioGroup className="grid gap-2 sm:grid-cols-2" aria-labelledby="group-approval-label" value={formData.enableVotingRights ? "member" : "admin"} onValueChange={(value) => onVotingChange(value === "member")}>
            <Label htmlFor="group-member-vote" className="group-form-choice">
              <RadioGroupItem id="group-member-vote" value="member" className="mt-0.5 shrink-0" />
              <span><strong className="block">Member vote</strong><span className="text-muted-foreground">Eligible contributors vote.</span></span>
            </Label>
            <Label htmlFor="group-admin-approval" className="group-form-choice">
              <RadioGroupItem id="group-admin-approval" value="admin" className="mt-0.5 shrink-0" />
              <span><strong className="block">Group admin</strong><span className="text-muted-foreground">The admin can withdraw directly.</span></span>
            </Label>
          </RadioGroup>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">You can add a bank account from the group page. Your first three groups are free. After that, each new group costs ₦500.</p>
      </CardContent>
      <CardFooter className="group-form-actions grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>Back</Button>
        <Button type="submit" disabled={pending}>{pending ? "Please wait…" : "Create group"}</Button>
      </CardFooter>
    </form>
  );
}
