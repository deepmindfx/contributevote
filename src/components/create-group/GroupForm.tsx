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
import { compressBannerImage, formatByteSize, readFileAsDataUrl } from "@/lib/imageCompression";
import { uploadGroupCoverImage } from "@/services/supabase/groupImageService";
import { createGroupVirtualAccount, groupBankSupportLink } from "@/services/flutterwave/virtualAccounts";
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
type CreationAttempt = {
  owner: string;
  group: Parameters<typeof createGroupWithFee>[1];
  authorization: Parameters<typeof createGroupWithFee>[2];
  groupId?: string;
};

function readCreationAttempt(owner: string): CreationAttempt | null {
  try {
    const attempt: CreationAttempt | null = JSON.parse(localStorage.getItem(`group-creation-request:${owner}`) || "null");
    return attempt?.owner === owner && attempt.group?.name && attempt.authorization?.requestId ? attempt : null;
  } catch {
    return null;
  }
}

function readDraft(storageKey?: string): GroupDraft {
  let saved: Partial<GroupDraft> = {};
  try {
    if (storageKey) saved = JSON.parse(localStorage.getItem(storageKey) || "{}") ?? {};
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
  const { user } = useSupabaseUser();
  return user ? <AccountGroupForm key={user.id} owner={user.id} /> : null;
}

function AccountGroupForm({ owner }: { owner: string }) {
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const progressHeading = useRef<HTMLDivElement>(null);
  const submitPending = useRef(false);
  const mounted = useRef(false);
  const quoteRevision = useRef(0);
  const draftKey = `${FORM_STORAGE_KEY}:${owner}`;
  const stepKey = `${STEP_STORAGE_KEY}:${owner}`;
  const attemptKey = `group-creation-request:${owner}`;
  const [pendingAttempt, setPendingAttempt] = useState(() => readCreationAttempt(owner));
  const [bankSetupError, setBankSetupError] = useState("");
  const [bankSetupNeedsReview, setBankSetupNeedsReview] = useState(false);
  const [formData, setFormData] = useState(() => readDraft(draftKey));
  const [step, setStep] = useState<Step>(() => {
    try {
      const savedStep = localStorage.getItem(stepKey);
      return (savedStep === "settings" || savedStep === "3") && !getDetailsError(formData) ? "settings" : "goal";
    } catch {
      return "goal";
    }
  });
  const [checkingFee, setCheckingFee] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [bvnInput, setBvnInput] = useState("");
  const [verifyingBvn, setVerifyingBvn] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const coverSelection = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleCoverSelect = async (file: File | null) => {
    const selection = ++coverSelection.current;
    if (!file) {
      setCoverFile(null);
      setCoverPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB.");
      return;
    }
    try {
      const compressed = await compressBannerImage(file, {
        maxInputBytes: 10 * 1024 * 1024,
        maxWidth: 1600,
        maxHeight: 1200,
        targetMaxBytes: 320 * 1024,
      });
      const baseName = file.name.replace(/\.[^.]+$/, "") || "group-cover";
      const optimizedFile = new File([compressed.blob], `${baseName}.${compressed.ext}`, {
        type: compressed.mimeType,
      });
      const preview = await readFileAsDataUrl(compressed.blob);
      if (!mounted.current || coverSelection.current !== selection) return;
      setCoverFile(optimizedFile);
      setCoverPreviewUrl(preview);
      if (compressed.originalBytes > compressed.compressedBytes) {
        toast.success(
          `Cover photo optimized (${formatByteSize(compressed.originalBytes)} → ${formatByteSize(compressed.compressedBytes)} HD)`
        );
      }
    } catch (error) {
      if (mounted.current && coverSelection.current === selection) {
        toast.error(error instanceof Error ? error.message : "Could not process the selected cover photo.");
      }
    }
  };

  const stepNumber = step === "goal" ? 1 : 2;
  const hasVerifiedBvn = /^\d{11}$/.test(String(user?.bvn || "").trim());
  const accountRestricted = Boolean(user?.status && user.status !== "active");

  useEffect(() => {
    if (step !== "settings" || !hasVerifiedBvn || accountRestricted) return;
    const revision = ++quoteRevision.current;
    void checkGroupCreationEligibility(owner).then((eligibility) => {
      if (mounted.current && quoteRevision.current === revision && typeof eligibility?.free_remaining === "number") {
        setFreeRemaining(eligibility.free_remaining);
      }
    }).catch(() => {
      if (mounted.current && quoteRevision.current === revision) setFreeRemaining(null);
    });
    return () => { quoteRevision.current++; };
  }, [accountRestricted, hasVerifiedBvn, owner, step]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    } catch {
      // Ignore storage quota or restricted-mode errors
    }
  }, [draftKey, formData]);

  useEffect(() => {
    try {
      localStorage.setItem(stepKey, step);
    } catch {
      // Ignore storage quota or restricted-mode errors
    }
  }, [stepKey, step]);

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

  const rememberAttempt = (attempt: CreationAttempt) => {
    if (mounted.current) setPendingAttempt(attempt);
    try { localStorage.setItem(attemptKey, JSON.stringify(attempt)); } catch { /* Storage unavailable. */ }
  };

  const clearAttempt = (attempt: CreationAttempt) => {
    try {
      if (readCreationAttempt(owner)?.authorization.requestId === attempt.authorization.requestId) localStorage.removeItem(attemptKey);
    } catch { /* Storage unavailable. */ }
    if (mounted.current) setPendingAttempt(null);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(stepKey);
    } catch { /* Storage unavailable. */ }
  };

  const startDifferentGroup = () => {
    if (!pendingAttempt?.groupId || submitPending.current) return;
    clearAttempt(pendingAttempt);
    clearDraft();
    setFormData(readDraft());
    setStep("goal");
    coverSelection.current++;
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };

  const finishGroupCreation = (attempt: CreationAttempt) => {
    if (!attempt.groupId || !mounted.current) return;
    clearAttempt(attempt);
    clearDraft();
    void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
    navigate(`/groups/${attempt.groupId}`, { replace: true });
  };

  const createGroup = async (expectedFee: number, retry?: CreationAttempt) => {
    if (user?.id !== owner) return;
    const unresolved = retry ? null : readCreationAttempt(owner) ?? pendingAttempt;
    if (unresolved) {
      setPendingAttempt(unresolved);
      return;
    }

    setCreating(true);
    setShowFeeConfirmation(false);
    setBankSetupError("");
    setBankSetupNeedsReview(false);
    try {
      let attempt = retry;

      if (!attempt) {
        const toSafeIso = (raw: string, suffix: string) => {
          if (!raw) return null;
          const parsed = new Date(`${raw}${suffix}`);
          return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
        };
        attempt = {
          owner,
          authorization: { expectedFee, requestId: crypto.randomUUID() },
          group: {
            name: formData.name.trim(),
            description: formData.description.trim(),
            target_amount: Number(formData.targetAmount),
            category: formData.category,
            frequency: formData.frequency,
            privacy: formData.privacy,
            enable_voting_rights: formData.enableVotingRights,
            contribution_amount: Number(formData.contributionAmount) || null,
            start_date: toSafeIso(formData.startDate, "T00:00:00"),
            end_date: toSafeIso(formData.endDate, "T23:59:59"),
            voting_threshold: formData.votingThreshold,
            cover_image_url: coverFile ? await uploadGroupCoverImage(owner, coverFile) : null,
          },
        };
        if (!mounted.current) return;
        rememberAttempt(attempt);
      }
      let groupId = attempt.groupId;
      if (!groupId) {
        const result = await createGroupWithFee(owner, attempt.group, attempt.authorization);
        if (!result?.success) {
          clearAttempt(attempt);
          if (!mounted.current) return;
          if (result?.code === "GROUP_CREATION_FEE_CHANGED") {
            setFreeRemaining(result.free_remaining ?? null);
            if (result.required_amount === 500) {
              setShowFeeConfirmation(true);
              return;
            }
          }
          toast.error(result?.message || result?.error || "Couldn’t create the group. Try again.");
          return;
        }
        if (!result.group_id) throw new Error("Couldn’t confirm the group ID. Retry the same request.");
        groupId = result.group_id;
        attempt = { ...attempt, groupId };
        rememberAttempt(attempt);
      }

      const account = await createGroupVirtualAccount(groupId);
      if (!account.success) {
        if (mounted.current) {
          setBankSetupError(account.message || "The bank account couldn’t be linked. Try again.");
          setBankSetupNeedsReview(Boolean(account.needsReview));
        }
        return;
      }
      if (!mounted.current) return;
      toast.success("Group created and bank account linked.");
      finishGroupCreation(attempt);
    } catch (error: any) {
      console.error("Error creating group:", error);
      if (mounted.current) toast.error(error?.message || "Couldn’t confirm group creation. Try again.");
    } finally {
      if (mounted.current) setCreating(false);
    }
  };

  const submit = async () => {
    if (!user || submitPending.current) return;

    submitPending.current = true;
    setCheckingFee(true);
    try {
      const attempt = readCreationAttempt(owner) ?? pendingAttempt;
      if (attempt) {
        setPendingAttempt(attempt);
        return;
      }
      quoteRevision.current++;
      const eligibility = await checkGroupCreationEligibility(user.id);
      if (!mounted.current) return;
      setFreeRemaining(typeof eligibility?.free_remaining === "number" ? eligibility.free_remaining : null);
      if (eligibility?.can_create_group === false) {
        toast.error(eligibility.message || "You are not currently eligible to create a group.");
        return;
      }
      if (eligibility?.can_create_free === true) await createGroup(0);
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
      await createGroup(500);
    } finally {
      submitPending.current = false;
    }
  };

  const retryCreation = async () => {
    if (!pendingAttempt || submitPending.current) return;
    submitPending.current = true;
    try {
      await createGroup(pendingAttempt.authorization.expectedFee, pendingAttempt);
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

  if (pendingAttempt) {
    return (
      <Card className="cp-card-native space-y-3 p-5">
        <h2 className="text-lg font-semibold">{pendingAttempt.groupId ? "Linking your group bank account" : "Group creation pending"}</h2>
        <p className="break-words text-sm text-muted-foreground">
          {pendingAttempt.group.name} · {pendingAttempt.authorization.expectedFee === 0 ? "Free" : "₦500 confirmed"}
        </p>
        <p className="text-sm text-muted-foreground">
          {pendingAttempt.groupId ? "Your group is saved. Bank setup uses your saved BVN and won’t charge another group creation fee." : "Retry to confirm the result of this group creation request."}
        </p>
        {bankSetupError && <p role="alert" className="text-sm text-destructive">{bankSetupError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void retryCreation()} disabled={creating}>
            {pendingAttempt.groupId ? creating ? "Setting up bank account…" : "Retry bank setup" : creating ? "Creating group…" : "Retry group creation"}
          </Button>
          {pendingAttempt.groupId && !creating && <>
            <Button variant="outline" onClick={() => navigate(`/groups/${pendingAttempt.groupId}`)}>View saved group</Button>
            <Button variant="ghost" onClick={startDifferentGroup}>Create a different group</Button>
          </>}
        </div>
        {bankSetupNeedsReview && pendingAttempt.groupId && (
          <a className="inline-block text-sm font-medium text-primary underline" href={groupBankSupportLink(pendingAttempt.groupId)}>Contact support about this bank request</a>
        )}
      </Card>
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
            coverPreviewUrl={coverPreviewUrl}
            onCoverSelect={handleCoverSelect}
            onContinue={() => moveToStep("settings")}
          />
        ) : (
          <SettingsStep
            formData={formData}
            coverPreviewUrl={coverPreviewUrl}
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
