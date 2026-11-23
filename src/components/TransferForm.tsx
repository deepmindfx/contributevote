import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasTransactionPin } from "@/lib/transactionPin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { v4 as uuid } from "uuid";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  History,
  Loader2,
  Lock,
  Pencil,
  Receipt,
  Repeat2,
  Send,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import BrandLoader from "@/components/ui/BrandLoader";
import CollectiPayReceipt from "@/components/receipt/CollectiPayReceipt";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import { BankPicker } from "@/components/wallet/BankPicker";
import { BankMonogram, BeneficiariesPanel } from "@/components/wallet/BeneficiariesPanel";
import { MoneySentAnimation } from "@/components/wallet/MoneySentAnimation";
import { RecipientNicknameDialog } from "@/components/wallet/RecipientNicknameDialog";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { TransferAllowanceNotice } from "@/components/wallet/TransferAllowanceNotice";
import { useBankDirectory } from "@/hooks/useBankDirectory";
import { useTransferAllowance } from "@/hooks/useTransferAllowance";
import { useTransferStatus } from "@/hooks/useTransferStatus";
import { pricedTransferFee } from "@/services/supabase/pricingService";
import {
  beneficiaryKey,
  buildBeneficiaryPreferencePatch,
  fetchTransferBeneficiaries,
  formatAccountNumberSpaced,
  getAmountMagnitudeLabel,
  type BankOption,
  type TransferBeneficiary,
} from "@/services/supabase/beneficiaryService";
import { cn } from "@/lib/utils";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { ApiService } from "@/services/supabase/apiService";

type Transfer = {
  bank: BankOption;
  account: string;
  recipient: string;
  amount: number;
  fee: number;
  note: string;
  attemptId: string;
};

type TransferReceipt = {
  id?: number | string;
  reference?: string;
  created_at?: string;
  amount?: number;
  fee?: number;
  status?: string;
  full_name?: string;
  account_number?: string;
  bank_name?: string;
  narration?: string;
};

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
});
const money = (amount: number) => ngn.format(amount);

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
const QUICK_REMARKS = ["Food & Dining", "Bills & Utilities", "Family & Friends", "Transport", "Business"];

async function resolveRecipient(bankCode: string, account: string) {
  const result = await ApiService.resolveAccount(bankCode, account);
  const name = result.success && result.data?.account_name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Couldn’t verify the account number.");
  return name.trim();
}

export default function TransferForm() {
  const { user, refreshCurrentUser, updateProfile } = useSupabaseUser();
  const { allowance, loadError: allowanceError, reload: reloadAllowance } = useTransferAllowance(user?.id);
  const { refreshContributionData } = useSupabaseContribution();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<"recipient" | "amount">("recipient");
  const [bank, setBank] = useState<BankOption | null>(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [verification, setVerification] = useState<{ key: string; name: string | null }>();
  const [verificationRetry, retryVerification] = useState(0);
  const [review, setReview] = useState<Transfer | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [setupPinOpen, setSetupPinOpen] = useState(false);
  const [error, setError] = useState("");
  const sendInFlight = useRef(false);

  const bankDirectory = useBankDirectory();

  const savedBeneficiariesVersion = useMemo(() => {
    const prefs = (user?.preferences || {}) as Record<string, unknown>;
    return JSON.stringify({
      saved: prefs.savedBeneficiaries ?? null,
      hidden: prefs.hiddenBeneficiaries ?? null,
      hiddenAt: prefs.hiddenBeneficiaryTimestamps ?? null,
    });
  }, [user?.preferences]);

  const beneficiariesQuery = useQuery({
    queryKey: ["transfer-beneficiaries", user?.id, bankDirectory.data?.length ?? 0, savedBeneficiariesVersion],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: () =>
      fetchTransferBeneficiaries(user!.id, bankDirectory.data, user?.preferences, user?.name),
  });

  const beneficiaries = beneficiariesQuery.data || [];

  const updateTransferStatus = useCallback((status: string) => {
    setReceipt((previous) => (previous && previous.status !== status ? { ...previous, status } : previous));
    void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
  }, [refreshCurrentUser, refreshContributionData]);
  useTransferStatus(receipt?.reference, receipt?.status, user?.id, updateTransferStatus);

  const stage = receipt ? "receipt" : review ? "review" : step;
  const bankCode = bank?.code;
  const key = bankCode && account.length === 10 ? `${bankCode}/${account}` : "";
  const verified = key && verification?.key === key ? verification : undefined;
  const balance = Number(user?.wallet_balance || 0);
  const pinConfigured = hasTransactionPin(user?.preferences);
  const numericAmount = Number(amount);
  const amountValid =
    /^\d+(?:\.\d{1,2})?$/.test(amount) && numericAmount >= 100 && numericAmount <= 500000;
  const feeQuote = allowance && amountValid ? pricedTransferFee(numericAmount, allowance) : undefined;
  const total = Math.round((numericAmount + (feeQuote ?? 0)) * 100) / 100;
  const magnitudeLabel = getAmountMagnitudeLabel(numericAmount);
  const insufficientForTotal = amountValid && feeQuote !== undefined && total > balance;

  const activeBeneficiary = useMemo(() => {
    if (!bank || account.length !== 10) return undefined;
    const lookupKey = beneficiaryKey(bank.code, account);
    return beneficiaries.find((item) => item.key === lookupKey);
  }, [account, bank, beneficiaries]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [stage]);

  // Upgrade raw bank code labels once the Nigerian bank directory resolves
  useEffect(() => {
    if (!bank || !bankDirectory.data?.length || bank.name !== bank.code) return;
    const match = bankDirectory.data.find((b) => b.code.toLowerCase() === bank.code.toLowerCase());
    if (match && match.name !== bank.name) {
      setBank(match);
    }
  }, [bank, bankDirectory.data]);

  // Auto-resolve account name whenever bank + 10-digit account changes (skips if already verified for this key!)
  useEffect(() => {
    if (!key || !bankCode) return;
    if (verification?.key === key && verification.name) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void resolveRecipient(bankCode, account).then(
        (name) => {
          if (active) setVerification({ key, name });
        },
        () => {
          if (active) setVerification({ key, name: null });
        }
      );
    }, 120);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [account, bankCode, key, verificationRetry, verification?.key, verification?.name]);

  const handleToggleFavorite = async (item: {
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountName: string;
    nickname?: string;
    favorite: boolean;
  }) => {
    if (!user) return;
    const nextFavorite = !item.favorite;
    try {
      const patch = buildBeneficiaryPreferencePatch(user.preferences, {
        type: "upsert",
        item: {
          key: beneficiaryKey(item.bankCode, item.accountNumber),
          accountNumber: item.accountNumber,
          bankCode: item.bankCode,
          bankName: item.bankName,
          accountName: item.accountName,
          nickname: item.nickname,
          favorite: nextFavorite,
        },
      });
      await updateProfile({ preferences: patch as any });
      toast.success(nextFavorite ? "Added to favorites" : "Removed from favorites");
    } catch {
      toast.error("Couldn’t update favorite right now");
    }
  };

  const handleSaveNickname = async (
    item: {
      accountNumber: string;
      bankCode: string;
      bankName: string;
      accountName: string;
      favorite: boolean;
    },
    nickname: string
  ) => {
    if (!user) throw new Error("No user logged in");
    const patch = buildBeneficiaryPreferencePatch(user.preferences, {
      type: "upsert",
      item: {
        key: beneficiaryKey(item.bankCode, item.accountNumber),
        accountNumber: item.accountNumber,
        bankCode: item.bankCode,
        bankName: item.bankName,
        accountName: item.accountName,
        nickname: nickname || undefined,
        favorite: item.favorite || Boolean(nickname),
      },
    });
    await updateProfile({ preferences: patch as any });
    toast.success(nickname ? `Saved nickname “${nickname}”` : "Nickname cleared");
  };

  const handleHideRecent = async (item: TransferBeneficiary) => {
    if (!user) return;
    try {
      const patch = buildBeneficiaryPreferencePatch(user.preferences, {
        type: "hide",
        key: item.key,
      });
      await updateProfile({ preferences: patch as any });
      toast.success("Removed from recent recipients");
    } catch {
      toast.error("Couldn’t remove recipient");
    }
  };

  const handlePickBeneficiary = (item: TransferBeneficiary) => {
    const pickedBank: BankOption = { code: item.bankCode, name: item.bankName };
    const nextKey = `${pickedBank.code}/${item.accountNumber}`;
    setBank(pickedBank);
    setAccount(item.accountNumber);
    setVerification({ key: nextKey, name: item.accountName });
    setError("");
    setStep("amount");
  };

  const proceedToAmount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bank || account.length !== 10 || !verified?.name) {
      setError("Enter a 10-digit account number and choose the recipient’s bank first.");
      return;
    }
    setError("");
    setStep("amount");
  };

  const continueToReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (user?.status && user.status !== "active") {
      setError(
        `Your account is currently ${user.status}. Outgoing bank transfers are temporarily disabled.`
      );
      return;
    }
    if (!bank || !verified?.name) {
      setError("Choose a bank and verify the recipient’s account number.");
      setStep("recipient");
      return;
    }
    if (!amountValid) {
      setError("Enter an amount between ₦100 and ₦500,000 using up to two decimal places.");
      return;
    }
    if (feeQuote === undefined) {
      setError("Transfer pricing is unavailable. Refresh it before sending.");
      return;
    }
    if (total > balance) {
      setError(`Your balance needs to cover ${money(total)}, including the fee.`);
      return;
    }
    setError("");
    setReview({
      bank,
      account,
      recipient: verified.name,
      amount: numericAmount,
      fee: feeQuote,
      note: note.trim(),
      attemptId: uuid(),
    });
  };

  const backToAmount = () => {
    setPin("");
    setError("");
    setReview(null);
  };

  const executeTransfer = async (verifiedPin: string) => {
    if (!review || sendInFlight.current) return;
    if (Math.round((review.amount + review.fee) * 100) / 100 > balance) {
      setError("Your wallet balance changed. Go back to review the amount.");
      return;
    }

    sendInFlight.current = true;
    setSending(true);
    setPin("");
    setError("");
    let submitted = false;
    try {
      const recipient = await resolveRecipient(review.bank.code, review.account);
      if (recipient !== review.recipient) {
        backToAmount();
        setVerification({ key, name: recipient });
        setError("The bank returned a different recipient name. Review it before sending.");
        return;
      }
      submitted = true;
      const result = await ApiService.processTransfer({
        accountNumber: review.account,
        bankCode: review.bank.code,
        bankName: review.bank.name,
        beneficiaryName: recipient,
        amount: review.amount,
        currency: "NGN",
        narration: review.note || undefined,
        transactionPin: verifiedPin,
        expectedFee: review.fee,
        attemptId: review.attemptId,
      });
      if (result.status !== "success" || !result.data) {
        throw new Error(result?.message || "Transfer couldn’t be confirmed.");
      }
      setReceipt(result.data);
      reloadAllowance();
      void queryClient.invalidateQueries({ queryKey: ["transfer-beneficiaries"] });
      void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
    } catch (err) {
      if (submitted) void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
      const serverMsg = err instanceof Error && err.message ? err.message : "";
      if (serverMsg.startsWith("The transfer fee changed")) {
        backToAmount();
        reloadAllowance();
        setError(serverMsg);
        return;
      }
      setError(
        submitted
          ? serverMsg && !serverMsg.includes("Edge Function returned a non-2xx")
            ? serverMsg
            : "We couldn’t confirm the transfer. Check Wallet history before trying again."
          : "Couldn’t verify the recipient. Check the bank and account number and try again."
      );
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const confirmTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review || sendInFlight.current || !pinConfigured || !/^\d{4}$/.test(pin)) return;
    await executeTransfer(pin);
  };

  const historyHeaderLink = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 hover:text-white"
    >
      <Link to="/wallet-history">
        <History size={13} aria-hidden="true" />
        History
      </Link>
    </Button>
  );

  /* ==========================================================================
   * STEP 4: RECEIPT & SIGNATURE CELEBRATION
   * ======================================================================== */
  if (receipt && review) {
    const status = (receipt.status || "pending").toLowerCase();
    const complete = ["successful", "completed", "success"].includes(status);
    const failed = ["failed", "cancelled", "rejected", "declined", "error"].includes(status);
    const bankLabel = receipt.bank_name || review.bank.name;
    const acctLabel = receipt.account_number || review.account;
    const recipientFullName = receipt.full_name || review.recipient;
    const receiptPayload = {
      kind: "transfer" as const,
      title: "Bank transfer",
      status,
      amount: Number(receipt.amount ?? review.amount),
      fee: Number(receipt.fee ?? review.fee),
      date: receipt.created_at || new Date().toISOString(),
      reference: receipt.reference,
      transactionId: receipt.id ? String(receipt.id) : undefined,
      narration: receipt.narration || review.note,
      paymentMethod: "CollectiPay wallet",
      sender: { label: "From", name: user?.name || "CollectiPay wallet" },
      recipient: {
        label: "To",
        name: recipientFullName,
        subtitle: acctLabel,
        bankName: bankLabel,
      },
    };

    const currentSaved = beneficiaries.find(
      (b) => b.key === beneficiaryKey(review.bank.code, review.account)
    );

    return (
      <WalletFlow title="Transfer receipt" headerRight={historyHeaderLink}>
        <div className="cp-page-enter space-y-3.5">
          <MoneySentAnimation
            status={complete ? "sent" : failed ? "failed" : "processing"}
            amount={Number(receipt.amount ?? review.amount)}
            recipientName={recipientFullName}
            recipientSubline={`${bankLabel} · ${formatAccountNumberSpaced(acctLabel)}`}
            variant="transfer"
          />

          {/* 2x2 Native Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setReceiptDialogOpen(true)}
              className="cp-card-native cp-pressable flex items-center gap-2 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/35"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Receipt size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight text-foreground">
                  Share receipt
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Download PNG
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNicknameDialogOpen(true)}
              className="cp-card-native cp-pressable flex items-center gap-2 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/35"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Pencil size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight text-foreground">
                  {currentSaved?.nickname ? "Edit nickname" : "Save nickname"}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {currentSaved?.nickname || "Pin for 1-tap"}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setReview(null);
                setAmount("");
                setNote("");
                setPin("");
                setError("");
                setStep("amount");
              }}
              className="cp-card-native cp-pressable flex items-center gap-2 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/35"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Repeat2 size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight text-foreground">
                  Send again
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Same recipient
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                backToAmount();
                setBank(null);
                setAccount("");
                setAmount("");
                setNote("");
                setVerification(undefined);
                setStep("recipient");
              }}
              className="cp-card-native cp-pressable flex items-center gap-2 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/35"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <Send size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight text-foreground">
                  New transfer
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Pick recipient
                </span>
              </span>
            </button>
          </div>

          <Button asChild className="h-12 w-full rounded-xl font-bold">
            <Link to="/wallet-history">Done · View Wallet History</Link>
          </Button>
        </div>

        {/* Full Verified Receipt Modal */}
        <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
          <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4">
            <DialogHeader className="sr-only">
              <DialogTitle>Bank Transfer Receipt</DialogTitle>
              <DialogDescription>Verified CollectiPay bank transfer receipt.</DialogDescription>
            </DialogHeader>
            <CollectiPayReceipt
              data={receiptPayload}
              onDone={() => setReceiptDialogOpen(false)}
              doneLabel="Close"
            />
          </DialogContent>
        </Dialog>

        {nicknameDialogOpen && (
          <RecipientNicknameDialog
            accountName={recipientFullName}
            initialNickname={currentSaved?.nickname}
            onClose={() => setNicknameDialogOpen(false)}
            onSave={(nickname) => handleSaveNickname(
              {
                accountNumber: review.account,
                bankCode: review.bank.code,
                bankName: bankLabel,
                accountName: recipientFullName,
                favorite: true,
              },
              nickname,
            )}
          />
        )}
      </WalletFlow>
    );
  }

  /* ==========================================================================
   * STEP 3: REVIEW & 4-DIGIT PIN CONFIRMATION
   * ======================================================================== */
  if (review) {
    const fee = review.fee;
    const reviewTotal = Math.round((review.amount + fee) * 100) / 100;
    const reviewMagnitude = getAmountMagnitudeLabel(review.amount);
    const remainingBalance = Math.max(0, balance - reviewTotal);

    return (
      <WalletFlow
        title="Confirm transfer"
        onBack={backToAmount}
        backDisabled={sending}
        headerRight={historyHeaderLink}
      >
        {sending && (
          <BrandLoader
            variant="overlay"
            message={`Sending ${money(review.amount)}`}
            submessage="Waiting for confirmation from the bank."
          />
        )}
        <div className="cp-page-enter space-y-4">
          <Card className="cp-card-native overflow-hidden p-4 sm:p-6">
            {/* Hero Total Summary */}
            <div className="border-b border-border/70 pb-4 text-center">
              {reviewMagnitude && (
                <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
                  {reviewMagnitude}
                </span>
              )}
              <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {money(reviewTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total debited from your CollectiPay wallet
              </p>
            </div>

            {/* Reversibility Safety Reminder */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-foreground">
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <span>
                Double check the details below. Successful bank transfers cannot be reversed.
              </span>
            </div>

            {/* Structured Details List */}
            <dl className="wallet-value-rows mt-4 text-sm">
              <div>
                <dt>Bank</dt>
                <dd className="inline-flex items-center gap-2 font-semibold">
                  <BankMonogram bankName={review.bank.name} size="sm" />
                  <span>{review.bank.name}</span>
                </dd>
              </div>
              <div>
                <dt>Account number</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatAccountNumberSpaced(review.account)}
                </dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd className="font-semibold [overflow-wrap:anywhere]">{review.recipient}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="font-semibold tabular-nums">{money(review.amount)}</dd>
              </div>
              <div>
                <dt>Transfer fee</dt>
                <dd className="font-semibold tabular-nums">
                  {fee === 0 ? (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Free
                    </span>
                  ) : (
                    money(fee)
                  )}
                </dd>
              </div>
              {review.note && (
                <div>
                  <dt>Remark</dt>
                  <dd className="[overflow-wrap:anywhere]">{review.note}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold">Balance after</dt>
                <dd className="font-bold text-primary tabular-nums">{money(remainingBalance)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}{" "}
                {error.includes("Wallet history") && (
                  <Link className="underline" to="/wallet-history">
                    Open history
                  </Link>
                )}
              </p>
            )}

            <div className="mt-5 border-t border-border/70 pt-5">
              {pinConfigured ? (
                <form onSubmit={confirmTransfer} className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm font-semibold">
                        <Lock size={15} className="text-primary" aria-hidden="true" />
                        Enter 4-Digit PIN to Pay
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showPin ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        aria-label="Transaction PIN"
                        autoComplete="off"
                        value={pin}
                        disabled={sending}
                        inputMode="numeric"
                        onChange={(val) => {
                          setPin(val.replace(/\D/g, "").slice(0, 4));
                          setError("");
                        }}
                      >
                        <InputOTPGroup className="gap-2.5">
                          {[0, 1, 2, 3].map((idx) => (
                            <InputOTPSlot
                              key={idx}
                              index={idx}
                              className={cn(
                                "h-12 w-12 rounded-xl border text-lg font-bold",
                                !showPin &&
                                  pin[idx] &&
                                  "text-transparent after:absolute after:h-2.5 after:w-2.5 after:rounded-full after:bg-foreground"
                              )}
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sending}
                      onClick={backToAmount}
                      className="h-12 rounded-xl px-4 font-semibold"
                    >
                      Recheck
                    </Button>
                    <Button
                      type="submit"
                      disabled={sending || pin.length !== 4}
                      className="h-12 w-full rounded-xl font-bold"
                    >
                      Pay {money(reviewTotal)}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-[auto_1fr] gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sending}
                      onClick={backToAmount}
                      className="h-12 rounded-xl px-4 font-semibold"
                    >
                      Recheck
                    </Button>
                    <Button
                      type="button"
                      className="h-12 w-full rounded-xl font-bold"
                      onClick={() => setSetupPinOpen(true)}
                    >
                      Set PIN &amp; Pay {money(reviewTotal)}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full text-xs text-muted-foreground"
                    onClick={() => navigate("/settings?tab=security")}
                  >
                    Or open Security Settings
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <TransactionPinDialog
          open={setupPinOpen}
          onOpenChange={setSetupPinOpen}
          title="Authorize Bank Transfer"
          description={`Confirm sending ${money(review.amount)} to ${review.recipient}.`}
          amount={review.amount}
          confirmLabel={`Pay ${money(reviewTotal)}`}
          pending={sending}
          onVerified={async (verifiedPin) => {
            setSetupPinOpen(false);
            await executeTransfer(verifiedPin);
          }}
        />
      </WalletFlow>
    );
  }

  /* ==========================================================================
   * STEP 2: DEDICATED AMOUNT & REMARK SCREEN (OPay-Style Speed & Clarity)
   * ======================================================================== */
  if (step === "amount" && bank && verified?.name) {
    const isFav = Boolean(activeBeneficiary?.favorite);
    const displayRecipientName = activeBeneficiary?.nickname || verified.name;

    return (
      <WalletFlow
        title="Enter amount"
        description={
          <>
            Available balance{" "}
            <strong className="ml-1 font-semibold text-white tabular-nums">{money(balance)}</strong>
          </>
        }
        onBack={() => {
          setError("");
          setStep("recipient");
        }}
        headerRight={historyHeaderLink}
      >
        <div className="cp-page-enter space-y-3.5">
          {/* Selected Recipient Header Card */}
          <Card className="cp-card-native flex items-center justify-between gap-3 p-3.5 sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <BankMonogram bankName={bank.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{displayRecipientName}</p>
                {activeBeneficiary?.nickname && (
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {verified.name}
                  </p>
                )}
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatAccountNumberSpaced(account)} · {bank.name}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={isFav ? "Remove favorite" : "Save to favorites"}
                onClick={() =>
                  void handleToggleFavorite({
                    accountNumber: account,
                    bankCode: bank.code,
                    bankName: bank.name,
                    accountName: verified.name!,
                    nickname: activeBeneficiary?.nickname,
                    favorite: isFav,
                  })
                }
                className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500"
              >
                <Star
                  size={17}
                  className={isFav ? "fill-amber-400 text-amber-400" : undefined}
                />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-xs font-semibold text-primary"
                onClick={() => {
                  setError("");
                  setStep("recipient");
                }}
              >
                Change
              </Button>
            </div>
          </Card>

          <form onSubmit={continueToReview} className="space-y-3.5" noValidate>
            {/* Hero Amount Card */}
            <Card className="cp-card-native space-y-3.5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="transfer-amount" className="text-sm font-bold text-foreground">
                  Amount
                </Label>
                {magnitudeLabel && (
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
                    {magnitudeLabel}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 border-b border-border/80 pb-2.5">
                <span className="text-2xl font-extrabold text-foreground" aria-hidden="true">
                  ₦
                </span>
                <Input
                  id="transfer-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="100.00 – 500,000.00"
                  value={amount}
                  className="h-auto min-w-0 border-0 bg-transparent px-1 py-0 text-3xl font-extrabold tracking-tight tabular-nums shadow-none focus-visible:ring-0 md:text-3xl"
                  onChange={(event) => {
                    const stripped = event.target.value.replace(/,/g, "").replace(/[^0-9.]/g, "");
                    const [whole, ...decimals] = stripped.split(".");
                    const sanitized =
                      decimals.length > 0
                        ? `${whole}.${decimals.join("").slice(0, 2)}`
                        : whole;
                    setAmount(sanitized);
                    setError("");
                  }}
                />
                {amount && (
                  <button
                    type="button"
                    aria-label="Clear amount"
                    onClick={() => {
                      setAmount("");
                      setError("");
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* 1-Tap Quick Amount Chips */}
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((preset) => {
                  const selected = Number(amount) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(String(preset));
                        setError("");
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-bold tabular-nums transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/45 text-foreground hover:border-primary/40 hover:bg-accent"
                      )}
                    >
                      ₦{preset.toLocaleString()}
                    </button>
                  );
                })}
              </div>

              {/* Fee & Balance Status Strip */}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs",
                  insufficientForTotal
                    ? "bg-destructive/10 font-semibold text-destructive"
                    : "bg-muted/55 text-muted-foreground"
                )}
              >
                <span>
                  {insufficientForTotal
                    ? `Insufficient wallet balance (need ${money(total)})`
                    : feeQuote === undefined
                    ? "₦100 minimum · ₦500,000 maximum"
                    : feeQuote === 0
                    ? "Free bank transfer"
                    : `${money(feeQuote)} transfer fee`}
                </span>
                {feeQuote !== undefined && !insufficientForTotal && (
                  <span className="font-bold text-foreground tabular-nums">
                    Total {money(total)}
                  </span>
                )}
              </div>

              {allowanceError && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs">
                  <p role="alert">Transfer pricing couldn’t load.</p>
                  <Button type="button" size="sm" variant="outline" onClick={reloadAllowance}>
                    Retry
                  </Button>
                </div>
              )}
            </Card>

            {/* Remark Card */}
            <Card className="cp-card-native space-y-2.5 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <Label htmlFor="transfer-remark" className="text-sm font-bold text-foreground">
                  Remark
                </Label>
                <span className="text-[11px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="transfer-remark"
                aria-label="Transfer note"
                placeholder="What’s this for?"
                value={note}
                maxLength={100}
                onChange={(event) => setNote(event.target.value)}
                className="h-11 rounded-xl"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {QUICK_REMARKS.map((tag) => {
                  const active = note === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNote(active ? "" : tag)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        active
                          ? "border-primary bg-accent text-primary"
                          : "border-border/80 bg-muted/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </Card>

            {error && (
              <p role="alert" className="px-1 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-sm"
              disabled={!allowance || !amountValid || insufficientForTotal}
            >
              Continue <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>
        </div>
      </WalletFlow>
    );
  }

  /* ==========================================================================
   * STEP 1: RECIPIENT ACCOUNT + ONE-TAP RECENTS & FAVORITES
   * ======================================================================== */
  return (
    <WalletFlow
      title="Transfer to bank"
      description={
        <>
          Available balance{" "}
          <strong className="ml-1 font-semibold text-white tabular-nums">{money(balance)}</strong>
        </>
      }
      headerRight={historyHeaderLink}
    >
      <div className="cp-page-enter space-y-4">
        {allowance && <TransferAllowanceNotice allowance={allowance} />}
        <Button asChild variant="outline" className="w-full rounded-xl"><Link to="/transfer/bulk">Bulk transfer</Link></Button>

        {/* Recipient Account Input Card */}
        <Card className="cp-card-native p-4 sm:p-5">
          <form onSubmit={proceedToAmount} className="space-y-3.5" noValidate>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Recipient Account</h2>
              <span
                className={cn(
                  "text-[11px] font-bold tabular-nums",
                  account.length === 10 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {account.length}/10 digits
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <Label htmlFor="transfer-account" className="sr-only">
                  Account number
                </Label>
                <Input
                  id="transfer-account"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  placeholder="Enter 10-digit Account Number"
                  value={account}
                  className="h-12 rounded-xl font-mono text-base font-semibold tracking-wider tabular-nums"
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                    setAccount(digits);
                    setVerification(undefined);
                    setError("");
                  }}
                />
              </div>

              <BankPicker
                bank={bank}
                banks={bankDirectory.data}
                isError={bankDirectory.isError}
                isFetching={bankDirectory.isFetching}
                onRetry={() => void bankDirectory.refetch()}
                onSelect={(next) => {
                  setBank(next);
                  setError("");
                  if (bank?.code !== next.code) setVerification(undefined);
                }}
              />

              {/* Live Account Name Verification Pill */}
              {key && (
                <div
                  className={cn(
                    "min-w-0 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                    verified?.name
                      ? "border-primary/30 bg-accent/65"
                      : verified
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/50"
                  )}
                  role="status"
                >
                  {verified?.name ? (
                    <span className="flex items-center gap-2 font-bold text-primary [overflow-wrap:anywhere]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check size={12} aria-hidden="true" />
                      </span>
                      <span>{verified.name}</span>
                    </span>
                  ) : verified ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-destructive">
                        Couldn’t verify this account. Check bank &amp; number.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => {
                          setVerification(undefined);
                          retryVerification((count) => count + 1);
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
                      Verifying account details…
                    </span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-xl font-bold"
              disabled={!bank || account.length !== 10 || !verified?.name}
            >
              Next <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>
        </Card>

        {/* One-Tap Recents & Favorites Beneficiaries */}
        <BeneficiariesPanel
          beneficiaries={beneficiaries}
          loading={beneficiariesQuery.isLoading}
          onSelect={handlePickBeneficiary}
          onToggleFavorite={handleToggleFavorite}
          onSaveNickname={handleSaveNickname}
          onHideRecent={handleHideRecent}
        />
      </div>
    </WalletFlow>
  );
}
