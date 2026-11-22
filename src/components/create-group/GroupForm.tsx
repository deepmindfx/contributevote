import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import BrandLoader from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { checkGroupCreationEligibility, createGroupWithFee } from "@/services/supabase/groupEnhancementService";
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
  const stepNumber = step === "goal" ? 1 : 2;
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
            <p className="font-bold uppercase tracking-wider text-primary">
              Step {stepNumber} of 2
            </p>
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
