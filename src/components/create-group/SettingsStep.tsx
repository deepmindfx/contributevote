import type { FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Globe,
  Lock,
  ShieldCheck,
  Sparkles,
  Vote,
} from "lucide-react";
import { CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategoryLabel } from "@/services/supabase/groupEnhancementService";
import { cn } from "@/lib/utils";
import type { GroupDetails } from "./DetailsStep";

export type GroupSettings = {
  privacy: "public" | "private";
  enableVotingRights: boolean;
  votingThreshold: number;
};

const VOTING_THRESHOLDS = [
  { value: 50, label: "50%", tag: "Simple majority" },
  { value: 60, label: "60%", tag: "Recommended" },
  { value: 75, label: "75%", tag: "Supermajority" },
  { value: 80, label: "80%", tag: "High consensus" },
];

interface SettingsStepProps {
  formData: GroupDetails & GroupSettings;
  coverPreviewUrl?: string | null;
  freeRemaining?: number | null;
  onPrivacyChange: (privacy: GroupSettings["privacy"]) => void;
  onVotingChange: (enabled: boolean) => void;
  onThresholdChange: (threshold: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
}

export default function SettingsStep({
  formData,
  coverPreviewUrl,
  freeRemaining,
  onPrivacyChange,
  onVotingChange,
  onThresholdChange,
  onBack,
  onSubmit,
  pending,
}: SettingsStepProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const targetNum = Number(formData.targetAmount || 0);
  const feeDisplay =
    typeof freeRemaining === "number"
      ? freeRemaining > 0
        ? `Free (${freeRemaining} of 3 free pools left)`
        : "₦500 wallet fee"
      : "First 3 groups free · ₦500 after";

  return (
    <form onSubmit={handleSubmit}>
      <CardHeader className="group-form-heading pb-3 pt-5">
        <h2 className="text-xl font-bold tracking-tight">Governance &amp; privacy</h2>
        <CardDescription>
          Control who can join your pool and how withdrawals are authorized.
        </CardDescription>
      </CardHeader>

      <CardContent className="group-form-fields space-y-6 pb-6">
        {/* Privacy Selector */}
        <div className="space-y-2.5">
          <p id="group-privacy-label" className="text-sm font-semibold">
            Who can discover &amp; join?
          </p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-labelledby="group-privacy-label"
          >
            {[
              {
                value: "public" as const,
                title: "Public Pool",
                desc: "Discoverable in Explore; anyone with the link can join.",
                icon: Globe,
              },
              {
                value: "private" as const,
                title: "Private Invite-Only",
                desc: "Hidden from public search; only invited members can enter.",
                icon: Lock,
              },
            ].map((item) => {
              const Icon = item.icon;
              const selected = formData.privacy === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected}
                  onClick={() => onPrivacyChange(item.value)}
                  className="cp-tile-option flex items-start gap-3 p-3.5 text-left"
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-primary"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-bold text-foreground">
                        {item.title}
                      </strong>
                      {selected && (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Withdrawal Governance Selector */}
        <div className="space-y-2.5">
          <p id="group-approval-label" className="text-sm font-semibold">
            How are withdrawals approved?
          </p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-labelledby="group-approval-label"
          >
            {[
              {
                value: true,
                title: "Democratic Member Vote",
                desc: "Contributors vote before any payout leaves the group pool.",
                icon: Vote,
              },
              {
                value: false,
                title: "Group Admin Direct",
                desc: "Only you (the creator) authorize payouts without a vote.",
                icon: ShieldCheck,
              },
            ].map((item) => {
              const Icon = item.icon;
              const selected = formData.enableVotingRights === item.value;
              return (
                <button
                  key={String(item.value)}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected}
                  onClick={() => onVotingChange(item.value)}
                  className="cp-tile-option flex items-start gap-3 p-3.5 text-left"
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-primary"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-bold text-foreground">
                        {item.title}
                      </strong>
                      {selected && (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Voting Approval Threshold Picker */}
        {formData.enableVotingRights && (
          <div className="space-y-2.5 rounded-2xl border bg-muted/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Approval threshold</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
                {formData.votingThreshold}% approval required
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VOTING_THRESHOLDS.map((item) => {
                const selected = formData.votingThreshold === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    data-selected={selected}
                    onClick={() => onThresholdChange(item.value)}
                    className="cp-tile-option px-3 py-2.5 text-center"
                  >
                    <span className="block text-base font-extrabold tabular-nums text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.tag}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Withdrawals require at least 70% member participation and{" "}
              <strong className="text-foreground">{formData.votingThreshold}%</strong> approval votes.
            </p>
          </div>
        )}

        {/* Live Group Blueprint Summary Card */}
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[#0c3027] to-[#084c3d] text-white">
          {coverPreviewUrl && (
            <div className="relative h-32 w-full overflow-hidden">
              <img
                src={coverPreviewUrl}
                alt="Pool cover preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c3027] via-[#0c3027]/35 to-transparent" />
            </div>
          )}
          <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#dbf5b4] text-[#0c3027]">
                <CategoryIcon category={formData.category} size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b6dcc9]">
                  Pool Blueprint
                </p>
                <p className="truncate text-base font-bold text-white">
                  {formData.name.trim() || "Untitled Group"}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold capitalize text-[#dbf5b4]">
              {formData.frequency}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/15 pt-3.5 text-xs sm:grid-cols-3">
            <div>
              <span className="block text-[#b6dcc9]">Target Goal</span>
              <span className="mt-0.5 block text-sm font-bold tabular-nums text-white">
                ₦{targetNum.toLocaleString("en-NG")}
              </span>
            </div>
            <div>
              <span className="block text-[#b6dcc9]">Category &amp; Access</span>
              <span className="mt-0.5 block text-sm font-semibold text-white">
                {getCategoryLabel(formData.category)} ·{" "}
                <span className="capitalize">{formData.privacy}</span>
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="block text-[#b6dcc9]">Creation Fee</span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-[#dbf5b4]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {feeDisplay}
              </span>
            </div>
          </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="group-form-actions grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={pending}
          className="h-12 gap-1.5 rounded-xl font-semibold"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl font-semibold shadow-sm"
        >
          {pending ? "Verifying eligibility…" : "Create group pool"}
        </Button>
      </CardFooter>
    </form>
  );
}
