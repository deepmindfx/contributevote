import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLoader from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import {
  checkGroupCreationEligibility,
  createGroupWithFee,
  saveUserBvn,
} from "@/services/supabase/groupEnhancementService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DetailsStep, { getDetailsError } from "./DetailsStep";
import type { GroupDetails } from "./DetailsStep";
import SettingsStep from "./SettingsStep";
import type { GroupSettings } from "./SettingsStep";
import StepIndicator from "./StepIndicator";

const FORM_STORAGE_KEY = "group_creation_form_data";
const STEP_STORAGE_KEY = "group_creation_step";
type GroupDraft = GroupDetails & GroupSettings;
type Step = "goal" | "settings";

function readDraft(): GroupDraft {
  let saved: Partial<GroupDraft> = {};
  try {
    saved = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "{}") ?? {};
  } catch {
    // Start a fresh draft if saved data cannot be read.
  }

  return {
    name: saved.name ?? "",
    description: saved.description ?? "",
    targetAmount: String(saved.targetAmount || ""),
    contributionAmount: String(saved.contributionAmount || ""),
    category: saved.category || "personal",
    frequency: saved.frequency || "weekly",
    startDate: saved.startDate ?? "",
    endDate: saved.endDate ?? "",
    privacy: saved.privacy === "private" ? "private" : "public",
    enableVotingRights: saved.enableVotingRights !== false,
    votingThreshold: Number(saved.votingThreshold) || 60,
  };
}

export default function GroupForm() {
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const progressHeading = useRef<HTMLDivElement>(null);
  const submitPending = useRef(false);
  const [formData, setFormData] = useState(readDraft);
  const [step, setStep] = useState<Step>(() => {
    const savedStep = localStorage.getItem(STEP_STORAGE_KEY);
    return (savedStep === "settings" || savedStep === "3") && !getDetailsError(formData) ? "settings" : "goal";
  });
  const [checkingFee, setCheckingFee] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [bvnInput, setBvnInput] = useState("");
  const [verifyingBvn, setVerifyingBvn] = useState(false);

  const stepNumber = step === "goal" ? 1 : 2;
  const hasVerifiedBvn = /^\d{11}$/.test(String(user?.bvn || "").trim());
  const accountRestricted = Boolean(user?.status && user.status !== "active");
  const freeRemaining =
    typeof (user as any)?.groups_created_free_remaining === "number"
      ? (user as any).groups_created_free_remaining
      : null;

  useEffect(() => {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem(STEP_STORAGE_KEY, step);
  }, [step]);

  const update = <K extends keyof GroupDraft>(field: K, value: GroupDraft[K]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const moveToStep = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => {
      progressHeading.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      progressHeading.current?.focus({ preventScroll: true });
    });
  };

  const handleVerifyBvn = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = bvnInput.replace(/\D/g, "");
    if (clean.length !== 11) {
      toast.error("Enter a valid 11-digit Bank Verification Number (BVN).");
      return;
    }

    setVerifyingBvn(true);
    try {
      const res = await saveUserBvn(clean);
      if (!res?.success) {
        toast.error(res?.error || "Could not verify BVN.");
        return;
      }
      toast.success(`BVN ending in ${res.bvn_last4} verified! Group creation unlocked.`);
      setBvnInput("");
      await refreshCurrentUser();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save BVN. Please try again.");
    } finally {
      setVerifyingBvn(false);
    }
  };

  const createGroup = async () => {
    if (!user) return;

    setCreating(true);
    setShowFeeConfirmation(false);
    try {
      const result = await createGroupWithFee(user.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        target_amount: Number(formData.targetAmount),
        category: formData.category,
        frequency: formData.frequency,
        privacy: formData.privacy,
        enable_voting_rights: formData.enableVotingRights,
        contribution_amount: Number(formData.contributionAmount) || null,
        start_date: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        end_date: formData.endDate ? new Date(formData.endDate + "T23:59:59").toISOString() : null,
        voting_threshold: formData.votingThreshold,
      });

      if (!result?.success) {
        toast.error(result?.message || result?.error || "Couldn’t create the group. Try again.");
        return;
      }

      localStorage.removeItem(FORM_STORAGE_KEY);
      localStorage.removeItem(STEP_STORAGE_KEY);
      toast.success(result.message || "Group pool created.");
      await Promise.allSettled([refreshCurrentUser(), refreshContributionData()]);
      navigate(result.group_id ? "/groups/" + result.group_id : "/all-groups", { replace: true });
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Couldn’t create the group. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const submit = async () => {
    if (!user || submitPending.current) return;

    submitPending.current = true;
    setCheckingFee(true);
    try {
      const eligibility = await checkGroupCreationEligibility(user.id);
      if (eligibility?.can_create_group === false) {
        toast.error(eligibility.message || "You are not currently eligible to create a group.");
        return;
      }
      if (eligibility?.can_create_free === true) await createGroup();
      else if (eligibility?.can_create_free === false) setShowFeeConfirmation(true);
      else throw new Error("Group creation eligibility unavailable");
    } catch (error) {
      console.error("Error checking group creation fee:", error);
      toast.error("Couldn’t check the group creation fee. Try again.");
    } finally {
      setCheckingFee(false);
      submitPending.current = false;
    }
  };

  const confirmFee = async () => {
    if (submitPending.current) return;
    submitPending.current = true;
    try {
      await createGroup();
    } finally {
      submitPending.current = false;
    }
  };

  // AML Gate 1: Frozen / Paused account restriction
  if (accountRestricted) {
    return (
      <Card className="cp-card-native cp-page-enter p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/12 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          Account Currently {user?.status}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Creating new contribution pools is temporarily paused while your account status is{" "}
          <strong className="capitalize text-foreground">{user?.status}</strong>. Contact CollectiPay compliance support if you believe this is an error.
        </p>
        <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-5 h-11 rounded-xl">
          Return to Dashboard
        </Button>
      </Card>
    );
  }

  // AML Gate 2: Mandatory BVN Verification before creating any pool
  if (!hasVerifiedBvn) {
    return (
      <>
        {verifyingBvn && (
          <BrandLoader
            variant="overlay"
            message="Verifying your BVN"
            submessage="Running identity & anti-fraud checks before unlocking group creation…"
          />
        )}
        <Card className="cp-card-native cp-page-enter overflow-hidden">
          <div className="border-b bg-gradient-to-r from-[#075847] to-[#063b32] p-5 text-white sm:p-6">
            <div className="flex items-start gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dbf5b4] text-[#0c3027]">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#dbf5b4]">
                  Mandatory KYC &amp; AML Safeguard
                </span>
                <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-white">
                  Verify your BVN to create a group pool
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#cce9da]">
                  To keep CollectiPay safe from fraud and money laundering, every group organizer must verify a unique 11-digit Bank Verification Number before launching a pool.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerifyBvn} className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="kyc-bvn" className="text-sm font-semibold">
                11-Digit Bank Verification Number (BVN)
              </Label>
              <Input
                id="kyc-bvn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                placeholder="Enter your 11-digit BVN"
                value={bvnInput}
                onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="h-12 rounded-xl font-mono text-base font-bold tracking-[0.14em]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>One unique BVN per CollectiPay identity.</span>
                <span className="font-mono font-semibold tabular-nums">
                  {bvnInput.length}/11 digits
                </span>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/35 p-4 text-xs leading-relaxed text-muted-foreground space-y-1.5">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                How your BVN protects every pool:
              </p>
              <p>• Prevents anonymous shell groups and duplicate mule accounts.</p>
              <p>• Stored privately under strict row-level security — never visible to other members.</p>
              <p>• Automatically reused when issuing your group’s dedicated Flutterwave bank account.</p>
            </div>

            <Button
              type="submit"
              disabled={verifyingBvn || bvnInput.length !== 11}
              className="h-12 w-full rounded-xl font-bold"
            >
              Verify BVN &amp; Unlock Group Builder
            </Button>
          </form>
        </Card>
      </>
    );
  }

  return (
    <>
      {creating && (
        <BrandLoader
          variant="overlay"
          message="Creating your group pool"
          submessage="Configuring your pool rules and opening your group workspace…"
        />
      )}
      <Card className="group-form-shell cp-card-native cp-page-enter min-w-0 overflow-hidden">
        <div
          ref={progressHeading}
          tabIndex={-1}
          className="group-form-heading scroll-mt-20 border-b bg-muted/35 py-3.5"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <p className="font-bold uppercase tracking-wider text-primary">
                Step {stepNumber} of 2
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> BVN Verified
              </span>
            </div>
            {formData.name && (
              <span className="rounded-full bg-accent px-2.5 py-0.5 font-semibold text-primary">
                Draft auto-saved
              </span>
            )}
          </div>
          <StepIndicator currentStep={stepNumber} />
        </div>
        {step === "goal" ? (
          <DetailsStep
            formData={formData}
            handleChange={update}
            onContinue={() => moveToStep("settings")}
          />
        ) : (
          <SettingsStep
            formData={formData}
            freeRemaining={freeRemaining}
            onPrivacyChange={(privacy) => update("privacy", privacy)}
            onVotingChange={(enabled) => update("enableVotingRights", enabled)}
            onThresholdChange={(threshold) => update("votingThreshold", threshold)}
            onBack={() => moveToStep("goal")}
            onSubmit={submit}
            pending={checkingFee || creating}
          />
        )}
      </Card>

      <AlertDialog open={showFeeConfirmation} onOpenChange={setShowFeeConfirmation}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm the ₦500 group fee</AlertDialogTitle>
            <AlertDialogDescription>
              You’ve used your three free groups. Creating this group will deduct ₦500 from your wallet balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFee} className="rounded-xl">
              Create group · ₦500
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
