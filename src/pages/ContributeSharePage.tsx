import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { GroupCoverImage } from "@/components/contribution/GroupCover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { supabase } from "@/integrations/supabase/client";
import { WalletContributionService } from "@/services/supabase/walletContributionService";
import Header from "@/components/layout/Header";
import { LandingHeader } from "@/components/landing/LandingHeader";
import BrandLoader from "@/components/ui/BrandLoader";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import { GroupRules } from "@/components/contribution/GroupRules";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from "@/components/contribution/VerifiedCrowdfunderBadge";
import "@/styles/landing.css";

const ContributeSharePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const navigate = useNavigate();
  const [contribution, setContribution] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [amount, setAmount] = useState<number>(0);
  const [anonymousOverride, setIsAnonymous] = useState<boolean>();
  const isAnonymous =
    anonymousOverride ??
    (user?.preferences as { anonymousContributions?: boolean } | null)?.anonymousContributions ===
      true;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";

  useEffect(() => {
    const loadSharedGroup = async () => {
      if (!id) {
        setFetching(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("contribution_groups")
          .select("*")
          .eq("id", id)
          .eq("privacy", "public")
          .eq("status", "active")
          .single();

        if (!error && data && !data.archived) {
          setContribution(data);
          if (data.contribution_amount) {
            setAmount(Number(data.contribution_amount));
          }
        }
      } catch (error) {
        console.error("Error loading shared group:", error);
      } finally {
        setFetching(false);
      }
    };

    void loadSharedGroup();
  }, [id]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmount(isNaN(value) ? 0 : value);
  };

  const handleContribute = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please log in to contribute");
      navigate(`/auth?redirect=/contribute/share/${id}`, {
        state: { returnUrl: `/contribute/share/${id}` },
      });
      return;
    }

    if (user.status && user.status !== "active") {
      toast.error(
        `Your account is currently ${user.status}. Contributions are temporarily disabled.`
      );
      return;
    }

    if (amount < 100) {
      toast.error("Minimum contribution amount is ₦100");
      return;
    }

    const minAmount = Number(contribution?.contribution_amount || 0);
    if (minAmount > 0 && amount < minAmount) {
      toast.error(`Minimum contribution amount is ₦${minAmount.toLocaleString()}`);
      return;
    }

    if (Number(user.wallet_balance || 0) < amount) {
      toast.error("Insufficient funds in your wallet");
      return;
    }

    setPinDialogOpen(true);
  };

  const executeContribution = async (verifiedPin: string) => {
    if (!user || !contribution) return;
    setPinDialogOpen(false);
    setIsLoading(true);
    try {
      const result = await WalletContributionService.contributeFromWallet(
        user.id,
        contribution.id,
        amount,
        isAnonymous,
        verifiedPin
      );

      if (result.success) {
        await Promise.all([refreshCurrentUser(), refreshContributionData(true)]);
        navigate(`/groups/${contribution.id}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to process contribution");
    } finally {
      setIsLoading(false);
    }
  };

  const mainShellClass = isAuthenticated
    ? "cb-discover-main cb-discover-main--workspace cp-page-enter"
    : "cb-discover-main cb-discover-main--guest cp-page-enter";

  if (fetching) {
    return (
      <div className="cb-public-light min-h-dvh">
        {isAuthenticated ? (
          <Header />
        ) : (
          <LandingHeader isAuthenticated={false} startPath={startPath} />
        )}
        <main className={mainShellClass}>
          <div className="mx-auto max-w-xl px-4 py-16">
            <BrandLoader
              variant="page"
              message="Loading shared pool"
              submessage="Fetching transparent contribution details…"
            />
          </div>
        </main>
      </div>
    );
  }

  if (!contribution) {
    return (
      <div className="cb-public-light min-h-dvh">
        {isAuthenticated ? (
          <Header />
        ) : (
          <LandingHeader isAuthenticated={false} startPath={startPath} />
        )}
        <main className={mainShellClass}>
          <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
            <div className="cb-light-surface-card w-full p-8">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertCircle className="h-7 w-7" />
              </span>
              <h1 className="mt-4 font-['Instrument_Sans',sans-serif] text-xl font-extrabold text-[#0f1729]">
                Pool Not Available
              </h1>
              <p className="mt-2 text-sm text-[#64717d]">
                This contribution group doesn’t exist, is set to private, or has been archived.
              </p>
              <Link to="/discover" className="cb-btn cb-btn--primary mt-6 w-full">
                <span>Browse Public Pools</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentAmount = Number(contribution.current_amount || 0);
  const targetAmount = Number(contribution.target_amount || 1);
  const progress = Math.min((currentAmount / targetAmount) * 100, 100);
  const minContribution = Number(contribution.contribution_amount || 0);
  const description = contribution.description || "";

  return (
    <div className="cb-public-light min-h-dvh">
      {isLoading && (
        <BrandLoader
          variant="overlay"
          badge="Group Contribution"
          message={`Pooling ₦${Number(amount || 0).toLocaleString()}`}
          submessage={`Confirming your contribution to ${contribution?.name || "this group"}…`}
        />
      )}

      {isAuthenticated ? (
        <Header />
      ) : (
        <LandingHeader isAuthenticated={false} startPath={startPath} />
      )}

      <main className={mainShellClass}>
        <section className="cb-discover-hero pb-6" aria-labelledby="share-pool-title">
          <div className="cb-hero-grid-bg" aria-hidden="true" />
          <div className="cb-discover-glow" aria-hidden="true" />

          <div className="relative z-10 mx-auto max-w-xl px-4 sm:px-6">
            <Link
              to="/discover"
              className="mb-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#0f1729] shadow-sm transition-colors hover:bg-[#edf3f0]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Explore Public Pools
            </Link>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="cb-hero-kicker">
                <span className="cb-hero-kicker-tag">SHARED POOL</span>
                <span className="cb-hero-kicker-text">Direct Contribution Link</span>
              </div>
              {contribution.enable_voting_rights !== false && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e1f6eb] px-3 py-1 text-xs font-bold text-[#047857]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Vote-Protected
                </span>
              )}
            </div>

            <h1 id="share-pool-title" className="cb-discover-title">
              Contribute to <span className="text-[#059669]">{contribution.name}</span>
            </h1>
          </div>
        </section>

        <div className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
          <div className="cb-light-surface-card overflow-hidden">
            {contribution.cover_image_url && (
              <div className="aspect-[16/9] w-full overflow-hidden bg-[#e8efec]">
                <GroupCoverImage
                  reference={contribution.cover_image_url}
                  alt={contribution.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-5 p-5 sm:p-7">
              {/* Group Summary Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar className="h-12 w-12 rounded-2xl bg-[#e4f5ec] text-[#06694d]">
                    <AvatarFallback className="rounded-2xl bg-[#e4f5ec] font-bold text-[#06694d]">
                      {contribution.name?.charAt(0) || "G"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate font-['Instrument_Sans',sans-serif] text-lg font-extrabold text-[#0f1729]">
                      {contribution.name}
                    </h2>
                    {description && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#64717d]">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e4f5ec] text-[#06694d]">
                  <Wallet className="h-5 w-5" />
                </span>
              </div>

              {(contribution.is_verified ||
                contribution.is_pinned ||
                contribution.spotlight_label) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(contribution.is_pinned || contribution.spotlight_label) && (
                    <SpotlightBadge
                      label={contribution.spotlight_label}
                      isPinned={Boolean(contribution.is_pinned)}
                    />
                  )}
                  {contribution.is_verified && <VerifiedCrowdfunderBadge />}
                </div>
              )}

              {/* Crisp Progress Box */}
              <div className="rounded-2xl bg-[#f5f8f6] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-['Instrument_Sans',sans-serif] text-2xl font-extrabold tracking-tight text-[#0f1729] tabular-nums">
                    ₦{currentAmount.toLocaleString("en-NG")}
                  </span>
                  <span className="rounded-full bg-[#e1f6eb] px-2.5 py-0.5 text-xs font-bold text-[#047857] tabular-nums">
                    {progress.toFixed(0)}% funded
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#64717d] tabular-nums">
                  of ₦{targetAmount.toLocaleString("en-NG")} target goal
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#dfe8e3]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#075847] to-[#059669] transition-all duration-300"
                    style={{ width: `${Math.max(progress, currentAmount > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>

              <GroupRules group={contribution} />

              {contribution.account_number && (
                <div className="rounded-2xl bg-[#f5f8f6] p-4">
                  <AccountNumberDisplay
                    accountNumber={contribution.account_number}
                    accountName={contribution.account_name || contribution.name}
                  />
                  <p className="mt-2 text-xs text-[#64717d]">
                    You can also transfer directly from any Nigerian bank app ({contribution.bank_name || contribution.account_details?.bank_name || "Dedicated Virtual Account"}).
                  </p>
                </div>
              )}

              {/* Amount Input & Quick Presets */}
              <div className="space-y-3 pt-1">
                <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-[#4b5b53]">
                  Contribution Amount (₦)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min={minContribution || 100}
                  step="100"
                  placeholder="Enter amount in Naira"
                  value={amount || ""}
                  onChange={handleAmountChange}
                  className="h-12 rounded-xl border-[#d5e0db] bg-white text-base font-bold text-[#0f1729] tabular-nums"
                />
                {minContribution > 0 && (
                  <p className="text-xs text-[#64717d]">
                    Minimum contribution: ₦{minContribution.toLocaleString("en-NG")}
                  </p>
                )}

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[500, 1000, 5000, 10000].map((value) => {
                    const selected = amount === value;
                    const isDisabled = minContribution > 0 && value < minContribution;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setAmount(value)}
                        className={
                          selected
                            ? "h-10 rounded-xl bg-[#071913] text-xs font-bold text-white shadow-sm tabular-nums"
                            : "h-10 rounded-xl bg-[#f2f6f4] text-xs font-bold text-[#0f1729] transition-colors hover:bg-[#e5ede9] disabled:opacity-40 tabular-nums"
                        }
                      >
                        ₦{value.toLocaleString("en-NG")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Selector */}
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#4b5b53]">
                  Contribution Visibility
                </Label>
                <RadioGroup
                  value={isAnonymous ? "anonymous" : "public"}
                  onValueChange={(v) => setIsAnonymous(v === "anonymous")}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <label
                    htmlFor="share-public"
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#f5f8f6] p-3 text-xs font-semibold text-[#0f1729] transition-colors hover:bg-[#ebf1ee]"
                  >
                    <RadioGroupItem value="public" id="share-public" />
                    <span>Public (Show my name)</span>
                  </label>
                  <label
                    htmlFor="share-anonymous"
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#f5f8f6] p-3 text-xs font-semibold text-[#0f1729] transition-colors hover:bg-[#ebf1ee]"
                  >
                    <RadioGroupItem value="anonymous" id="share-anonymous" />
                    <span>Anonymous (Hide my name)</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Primary CTA */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleContribute}
                  disabled={isLoading || amount <= 0}
                  className="cb-btn cb-btn--primary w-full disabled:opacity-50"
                >
                  <span>
                    {isLoading
                      ? "Processing…"
                      : `Contribute ₦${Number(amount || 0).toLocaleString("en-NG")}`}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[11px] font-medium text-[#64717d]">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                    4-Digit PIN Verified
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#059669]" />
                    Instant Ledger Receipt
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TransactionPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        title="Authorize Contribution"
        description={`Enter your 4-digit Transaction PIN to contribute to ${contribution.name}.`}
        amount={amount}
        confirmLabel="Contribute Now"
        pending={isLoading}
        onVerified={executeContribution}
      />
    </div>
  );
};

export default ContributeSharePage;
