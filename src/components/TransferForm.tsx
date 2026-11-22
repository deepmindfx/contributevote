import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { v4 as uuid } from "uuid";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, ChevronRight, Clock3, Eye, EyeOff, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import BrandLoader from "@/components/ui/BrandLoader";
import CollectiPayReceipt from "@/components/receipt/CollectiPayReceipt";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { TransferAllowanceNotice } from "@/components/wallet/TransferAllowanceNotice";
import { useTransferAllowance } from "@/hooks/useTransferAllowance";
import { useTransferStatus } from "@/hooks/useTransferStatus";
import { pricedTransferFee } from "@/services/supabase/pricingService";
import { cn } from "@/lib/utils";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { ApiService } from "@/services/supabase/apiService";

type Bank = { code: string; name: string };
type Transfer = { bank: Bank; account: string; recipient: string; amount: number; fee: number; note: string; attemptId: string };
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

const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" });
const money = (amount: number) => ngn.format(amount);

async function resolveRecipient(bankCode: string, account: string) {
  const result = await ApiService.resolveAccount(bankCode, account);
  const name = result.success && result.data?.account_name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Couldn’t verify the account number.");
  return name.trim();
}

const POPULAR_BANK_KEYWORDS = [
  "opay",
  "palmpay",
  "kuda",
  "moniepoint",
  "guaranty trust",
  "access bank",
  "zenith bank",
  "united bank for africa",
  "first bank",
];

function BankPicker({ bank, onSelect }: { bank: Bank | null; onSelect: (bank: Bank) => void }) {
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mobileViewport, setMobileViewport] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (!open || banks) return;
    let active = true;
    setError(false);
    void ApiService.getBanks().then(
      (result) => {
        if (!active) return;
        if (!Array.isArray(result?.data) || result.data.length === 0) setError(true);
        else setBanks(result.data);
      },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [banks, open, retry]);

  // Track visualViewport on mobile so the bank sheet stays 100% visible above the on-screen keyboard
  useEffect(() => {
    if (!open || typeof window === "undefined") {
      setMobileViewport(null);
      return;
    }

    const updateViewport = () => {
      if (window.innerWidth >= 640) {
        setMobileViewport(null);
        return;
      }
      const vv = window.visualViewport;
      const height = vv ? Math.round(vv.height) : window.innerHeight;
      const top = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
      setMobileViewport({ height, top });
    };

    updateViewport();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateViewport);
    vv?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      vv?.removeEventListener("resize", updateViewport);
      vv?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [open]);

  const query = search.trim().toLowerCase();
  const choices = banks?.filter(({ name }) => name.toLowerCase().includes(query));
  const popularBanks =
    !query && banks
      ? POPULAR_BANK_KEYWORDS.map((kw) =>
          banks.find((b) => b.name.toLowerCase().includes(kw))
        ).filter((b, idx, arr): b is Bank => Boolean(b) && arr.findIndex((x) => x?.code === b?.code) === idx)
      : [];

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-12 w-full justify-between gap-2 rounded-xl px-3" aria-label={bank ? `Bank, ${bank.name}` : "Choose bank"}>
          <span className="flex min-w-0 items-center gap-2"><Building2 size={17} className="shrink-0 text-primary" aria-hidden="true" /><span className="truncate">{bank?.name || "Choose bank"}</span></span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // On mobile, let the user view the bank list first without the soft keyboard slamming open
          if (typeof window !== "undefined" && window.innerWidth < 640) {
            event.preventDefault();
          }
        }}
        style={
          mobileViewport
            ? {
                top: `${mobileViewport.top}px`,
                maxHeight: `${Math.max(240, mobileViewport.height - 8)}px`,
                height: `${Math.min(Math.max(260, mobileViewport.height - 8), 580)}px`,
              }
            : undefined
        }
        className="inset-x-0 bottom-auto top-0 flex flex-col gap-3 overflow-hidden rounded-b-3xl rounded-t-none p-4 pt-[max(1rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(85dvh,36rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-[state=closed]:slide-out-to-top-0 sm:data-[state=open]:slide-in-from-top-0"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Choose a bank</DialogTitle>
          <DialogDescription>Select or search the recipient’s Nigerian bank.</DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search banks"
            className="h-11 rounded-xl pl-9 pr-9"
            placeholder="Search bank name (e.g. OPay, GTBank)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear bank search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {popularBanks.length > 0 && (
          <div className="shrink-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Popular banks
            </p>
            <div className="flex flex-wrap gap-1.5">
              {popularBanks.slice(0, 6).map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  onClick={() => {
                    onSelect(choice);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    choice.code === bank?.code
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-accent"
                  )}
                >
                  {choice.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm"><p role="alert">Couldn’t load banks.</p><Button variant="outline" onClick={() => setRetry((count) => count + 1)}>Retry</Button></div>
        ) : choices ? (
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain rounded-xl border sm:max-h-[22rem]">
            {choices.map((choice) => (
              <li key={choice.code}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:bg-muted"
                  onClick={() => { onSelect(choice); setOpen(false); }}
                >
                  <span className="break-words">{choice.name}</span>
                  {choice.code === bank?.code && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            ))}
            {choices.length === 0 && <li className="p-3 text-sm text-muted-foreground">No banks match “{search.trim()}”.</li>}
          </ul>
        ) : <p role="status" className="text-sm text-muted-foreground">Loading banks…</p>}
      </DialogContent>
    </Dialog>
  );
}

export default function TransferForm() {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { allowance, loadError: allowanceError, reload: reloadAllowance } = useTransferAllowance(user?.id);
  const { refreshContributionData } = useSupabaseContribution();
  const navigate = useNavigate();
  const [bank, setBank] = useState<Bank | null>(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [verification, setVerification] = useState<{ key: string; name: string | null }>();
  const [verificationRetry, retryVerification] = useState(0);
  const [review, setReview] = useState<Transfer | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const updateTransferStatus = useCallback((status: string) => {
    setReceipt((previous) => previous ? { ...previous, status } : previous);
  }, []);
  useTransferStatus(receipt?.reference, receipt?.status, user?.id, updateTransferStatus);
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [setupPinOpen, setSetupPinOpen] = useState(false);
  const [error, setError] = useState("");
  const sendInFlight = useRef(false);
  const stage = receipt ? "receipt" : review ? "review" : "details";
  const bankCode = bank?.code;
  const key = bankCode && account.length === 10 ? `${bankCode}/${account}` : "";
  const verified = key && verification?.key === key ? verification : undefined;
  const balance = Number(user?.wallet_balance || 0);
  const preferences = user?.preferences as { transactionPin?: string } | null;
  const userPin = preferences?.transactionPin;
  const numericAmount = Number(amount);
  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(amount) && numericAmount >= 100 && numericAmount <= 500000;
  const feeQuote = allowance && amountValid ? pricedTransferFee(numericAmount, allowance) : undefined;
  const total = Math.round((numericAmount + (feeQuote ?? 0)) * 100) / 100;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [stage]);

  useEffect(() => {
    if (!key || !bankCode) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void resolveRecipient(bankCode, account).then(
        (name) => { if (active) setVerification({ key, name }); },
        () => { if (active) setVerification({ key, name: null }); },
      );
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [account, bankCode, key, verificationRetry]);

  const continueToReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (user?.status && user.status !== "active") {
      setError(`Your account is currently ${user.status}. Outgoing bank transfers are temporarily disabled.`);
      return;
    }
    if (!bank || !verified?.name) {
      setError("Choose a bank and verify the recipient’s account number.");
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
    setReview({ bank, account, recipient: verified.name, amount: numericAmount, fee: feeQuote, note: note.trim(), attemptId: uuid() });
  };

  const backToDetails = () => {
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
        backToDetails();
        setVerification({ key, name: recipient });
        setError("The bank returned a different recipient name. Review it before sending.");
        return;
      }
      submitted = true;
      const result = await ApiService.processTransfer({
        accountNumber: review.account,
        bankCode: review.bank.code,
        beneficiaryName: recipient,
        amount: review.amount,
        currency: "NGN",
        narration: review.note || undefined,
        transactionPin: verifiedPin,
        expectedFee: review.fee,
        attemptId: review.attemptId,
      });
      if (result.status !== "success" || !result.data) throw new Error(result?.message || "Transfer couldn’t be confirmed.");
      setReceipt(result.data);
      reloadAllowance();
      void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
    } catch (err) {
      if (submitted) void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
      const serverMsg = err instanceof Error && err.message ? err.message : "";
      if (serverMsg.startsWith("The transfer fee changed")) {
        backToDetails();
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
    if (!review || sendInFlight.current || !userPin) return;
    if (pin !== userPin) {
      setError("That transaction PIN is incorrect.");
      setPin("");
      return;
    }
    await executeTransfer(pin);
  };

  if (receipt && review) {
    const status = (receipt.status || "pending").toLowerCase();
    const complete = ["successful", "completed", "success"].includes(status);
    const failed = ["failed", "cancelled", "rejected", "declined", "error"].includes(status);
    const Icon = complete ? Check : failed ? X : Clock3;
    return (
      <WalletFlow title="Transfer receipt">
        <Card className="mb-3 space-y-2 rounded-2xl p-5 text-center">
          <div className={`transfer-result-icon ${complete ? "transfer-result-icon--sent" : ""} mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary`}><Icon size={30} aria-hidden="true" /></div>
          <h2 aria-live="polite" className="text-lg font-semibold">{complete ? "Money sent" : failed ? "Transfer failed" : "Transfer processing"}</h2>
          <p className="break-words text-3xl font-semibold tracking-tight tabular-nums">{money(Number(receipt.amount ?? review.amount))}</p>
          <p className="break-words text-sm text-muted-foreground">{receipt.full_name || review.recipient}{!complete && !failed ? " · Follow its status in Wallet history" : ""}</p>
        </Card>
        <details className="mb-3 rounded-2xl border bg-card p-3">
          <summary className="app-disclosure font-semibold">View receipt</summary>
          <CollectiPayReceipt data={{
            kind: "transfer", title: "Bank transfer", status, amount: Number(receipt.amount ?? review.amount),
            fee: Number(receipt.fee ?? review.fee), date: receipt.created_at || new Date().toISOString(),
            reference: receipt.reference, transactionId: receipt.id ? String(receipt.id) : undefined,
            narration: receipt.narration || review.note, paymentMethod: "CollectiPay wallet",
            sender: { label: "From", name: user?.name || "CollectiPay wallet" },
            recipient: { label: "To", name: receipt.full_name || review.recipient, subtitle: receipt.account_number || review.account, bankName: receipt.bank_name || review.bank.name },
          }} />
        </details>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild className="h-11"><Link to="/wallet-history">Wallet history</Link></Button>
          <Button variant="outline" className="h-11" onClick={() => {
            setReceipt(null); backToDetails(); setBank(null); setAccount(""); setAmount(""); setNote(""); setVerification(undefined);
          }}>New transfer</Button>
        </div>
      </WalletFlow>
    );
  }

  if (review) {
    const fee = review.fee;
    return (
      <WalletFlow title="Review transfer" onBack={backToDetails} backDisabled={sending}>
        {sending && <BrandLoader variant="overlay" message={`Sending ${money(review.amount)}`} submessage="Waiting for confirmation from the bank." />}
        <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
          <div className="rounded-2xl bg-accent/50 p-3">
            <p className="text-sm text-muted-foreground">Send to</p>
            <p className="break-words font-semibold [overflow-wrap:anywhere]">{review.recipient}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{review.bank.name} · {review.account}</p>
          </div>
          <dl className="wallet-value-rows text-sm">
            <div><dt>Amount</dt><dd>{money(review.amount)}</dd></div>
            <div><dt>Transfer fee</dt><dd>{fee === 0 ? "Free" : money(fee)}</dd></div>
            {review.note && <div><dt>Note</dt><dd>{review.note}</dd></div>}
            <div><dt className="font-semibold">Total from wallet</dt><dd>{money(review.amount + fee)}</dd></div>
          </dl>
          {error && <p role="alert" className="text-sm text-destructive">{error} {error.includes("Wallet history") && <Link className="underline" to="/wallet-history">Open history</Link>}</p>}
          {userPin ? (
            <form onSubmit={confirmTransfer} className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Lock size={15} className="text-primary" aria-hidden="true" />
                    4-Digit Transaction PIN
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
              <Button type="submit" disabled={sending || pin.length !== 4} className="h-12 w-full rounded-xl font-bold">
                Send {money(review.amount)}
              </Button>
            </form>
          ) : (
            <div className="space-y-2.5">
              <Button
                type="button"
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => setSetupPinOpen(true)}
              >
                Create 4-digit PIN &amp; Send {money(review.amount)}
              </Button>
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
        </Card>
        <TransactionPinDialog
          open={setupPinOpen}
          onOpenChange={setSetupPinOpen}
          title="Authorize Bank Transfer"
          description={`Confirm sending ${money(review.amount)} to ${review.recipient}.`}
          amount={review.amount}
          confirmLabel={`Send ${money(review.amount)}`}
          pending={sending}
          onVerified={async (verifiedPin) => {
            setSetupPinOpen(false);
            await executeTransfer(verifiedPin);
          }}
        />
      </WalletFlow>
    );
  }

  return (
    <WalletFlow title="Send money" description={<>Available balance <strong className="ml-1 font-semibold text-white">{money(balance)}</strong></>}>
      <Card className="rounded-2xl p-4 sm:p-6">
        <form onSubmit={continueToReview} className="space-y-4" noValidate>
          {allowance && <TransferAllowanceNotice allowance={allowance} />}
          {allowanceError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <p role="alert">Transfer pricing couldn’t load.</p>
              <Button type="button" variant="outline" onClick={reloadAllowance}>Retry</Button>
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Recipient</h2>
            <BankPicker bank={bank} onSelect={(next) => { setBank(next); setError(""); if (bank?.code !== next.code) setVerification(undefined); }} />
            <Label htmlFor="transfer-account">Account number</Label>
            <Input id="transfer-account" type="text" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="10-digit account number" value={account}
              onChange={(event) => { setAccount(event.target.value.replace(/\D/g, "").slice(0, 10)); setVerification(undefined); setError(""); }} />
            {key && (
              <div className="min-w-0 rounded-xl bg-accent/50 px-3 py-2.5 text-sm" role="status">
                {verified?.name ? <span className="flex items-start gap-2 font-semibold text-primary [overflow-wrap:anywhere]"><Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {verified.name}</span>
                  : verified ? <div className="flex flex-wrap items-center justify-between gap-2"><span>Couldn’t verify this account.</span><Button type="button" variant="outline" onClick={() => { setVerification(undefined); retryVerification((count) => count + 1); }}>Retry</Button></div>
                    : "Verifying account…"}
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-xl border p-3">
            <Label htmlFor="transfer-amount">Amount</Label>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <span aria-hidden="true">₦</span>
              <Input id="transfer-amount" type="number" inputMode="decimal" min="100" max="500000" step="0.01" placeholder="0.00" value={amount}
                className="min-w-0 border-0 bg-transparent px-1 text-2xl font-semibold tabular-nums md:text-2xl" onChange={(event) => { setAmount(event.target.value); setError(""); }} />
            </div>
            <p className="text-xs text-muted-foreground">{feeQuote === undefined ? "₦100 minimum · ₦500,000 maximum" : (feeQuote === 0 ? "Free transfer" : money(feeQuote) + " transfer fee") + " · " + money(total) + " total"}</p>
          </div>
          <details className="rounded-xl border px-3">
            <summary className="app-disclosure font-medium">Add a note <span className="text-xs text-muted-foreground">Optional</span></summary>
            <div className="pb-3"><Input aria-label="Transfer note" value={note} maxLength={100} onChange={(event) => setNote(event.target.value)} /></div>
          </details>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full gap-2" disabled={!allowance || Boolean(key && !verified)}>Review transfer <ArrowRight size={16} aria-hidden="true" /></Button>
        </form>
      </Card>
    </WalletFlow>
  );
}
