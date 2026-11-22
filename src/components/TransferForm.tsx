import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, ChevronRight, Clock3, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLoader from "@/components/ui/BrandLoader";
import CollectiPayReceipt from "@/components/receipt/CollectiPayReceipt";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { ApiService } from "@/services/supabase/apiService";

type Bank = { code: string; name: string };
type Transfer = { bank: Bank; account: string; recipient: string; amount: number; note: string };
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

const feeFor = (amount: number) => amount > 5000 ? 26.5 : 10.75;
const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol" });
const money = (amount: number) => ngn.format(amount);

async function resolveRecipient(bankCode: string, account: string) {
  const result = await ApiService.resolveAccount(bankCode, account);
  const name = result.success && result.data?.account_name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Couldn’t verify the account number.");
  return name.trim();
}

function BankPicker({ bank, onSelect }: { bank: Bank | null; onSelect: (bank: Bank) => void }) {
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

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

  const choices = banks?.filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setSearch(""); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-12 w-full justify-between gap-2 rounded-xl px-3" aria-label={bank ? `Bank, ${bank.name}` : "Choose bank"}>
          <span className="flex min-w-0 items-center gap-2"><Building2 size={17} className="shrink-0 text-primary" aria-hidden="true" /><span className="truncate">{bank?.name || "Choose bank"}</span></span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a bank</DialogTitle>
          <DialogDescription>Select the recipient’s Nigerian bank.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Search banks" className="pl-9" placeholder="Search banks" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm"><p role="alert">Couldn’t load banks.</p><Button variant="outline" onClick={() => setRetry((count) => count + 1)}>Retry</Button></div>
        ) : choices ? (
          <ul className="max-h-[min(45dvh,22rem)] divide-y overflow-auto rounded-xl border">
            {choices.map((choice) => (
              <li key={choice.code}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted" onClick={() => { onSelect(choice); setOpen(false); }}>
                  {choice.name}{choice.code === bank?.code && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            ))}
            {choices.length === 0 && <li className="p-3 text-sm text-muted-foreground">No banks match your search.</li>}
          </ul>
        ) : <p role="status" className="text-sm text-muted-foreground">Loading banks…</p>}
      </DialogContent>
    </Dialog>
  );
}

export default function TransferForm() {
  const { user, refreshCurrentUser } = useSupabaseUser();
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
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState("");
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
  const total = Math.round((numericAmount + feeFor(numericAmount)) * 100) / 100;

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
    if (total > balance) {
      setError(`Your balance needs to cover ${money(total)}, including the fee.`);
      return;
    }
    setError("");
    setReview({ bank, account, recipient: verified.name, amount: numericAmount, note: note.trim() });
  };

  const backToDetails = () => {
    setPin("");
    setError("");
    setReview(null);
  };

  const confirmTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review || sendInFlight.current || !userPin) return;
    if (pin !== userPin) {
      setError("That transaction PIN is incorrect.");
      setPin("");
      return;
    }
    if (Math.round((review.amount + feeFor(review.amount)) * 100) / 100 > balance) {
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
        accountNumber: review.account, bankCode: review.bank.code, beneficiaryName: recipient,
        amount: review.amount, currency: "NGN", narration: review.note || undefined,
      });
      if (result.status !== "success" || !result.data) throw new Error(result?.message || "Transfer couldn’t be confirmed.");
      setReceipt(result.data);
      void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
    } catch (err) {
      if (submitted) void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
      const serverMsg = err instanceof Error && err.message ? err.message : "";
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

  if (receipt && review) {
    const status = (receipt.status || "pending").toLowerCase();
    const complete = ["successful", "completed", "success"].includes(status);
    const failed = ["failed", "cancelled", "rejected", "declined", "error"].includes(status);
    const Icon = complete ? Check : failed ? X : Clock3;
    return (
      <WalletFlow title="Transfer receipt">
        <Card className="mb-3 space-y-2 rounded-2xl p-5 text-center">
          <div className={`transfer-result-icon ${complete ? "transfer-result-icon--sent" : ""} mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary`}><Icon size={30} aria-hidden="true" /></div>
          <h2 className="text-lg font-semibold">{complete ? "Money sent" : failed ? "Transfer failed" : "Transfer processing"}</h2>
          <p className="break-words text-3xl font-semibold tracking-tight tabular-nums">{money(Number(receipt.amount ?? review.amount))}</p>
          <p className="break-words text-sm text-muted-foreground">{receipt.full_name || review.recipient}{!complete && !failed ? " · Follow its status in Wallet history" : ""}</p>
        </Card>
        <details className="mb-3 rounded-2xl border bg-card p-3">
          <summary className="app-disclosure font-semibold">View receipt</summary>
          <CollectiPayReceipt data={{
            kind: "transfer", title: "Bank transfer", status, amount: Number(receipt.amount ?? review.amount),
            fee: Number(receipt.fee ?? feeFor(review.amount)), date: receipt.created_at || new Date().toISOString(),
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
    const fee = feeFor(review.amount);
    return (
      <WalletFlow title="Review transfer" onBack={sending ? undefined : backToDetails}>
        {sending && <BrandLoader variant="overlay" message={`Sending ${money(review.amount)}`} submessage="Waiting for confirmation from the bank." />}
        <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
          <div className="rounded-2xl bg-accent/50 p-3">
            <p className="text-sm text-muted-foreground">Send to</p>
            <p className="break-words font-semibold [overflow-wrap:anywhere]">{review.recipient}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{review.bank.name} · {review.account}</p>
          </div>
          <dl className="wallet-value-rows text-sm">
            <div><dt>Amount</dt><dd>{money(review.amount)}</dd></div>
            <div><dt>Transfer fee</dt><dd>{money(fee)}</dd></div>
            {review.note && <div><dt>Note</dt><dd>{review.note}</dd></div>}
            <div><dt className="font-semibold">Total from wallet</dt><dd>{money(review.amount + fee)}</dd></div>
          </dl>
          {error && <p role="alert" className="text-sm text-destructive">{error} {error.includes("Wallet history") && <Link className="underline" to="/wallet-history">Open history</Link>}</p>}
          {userPin ? (
            <form onSubmit={confirmTransfer} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="transfer-pin" className="flex items-center gap-2"><Lock size={15} aria-hidden="true" /> Transaction PIN</Label>
                <Input id="transfer-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="4 digits" value={pin}
                  disabled={sending} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); setError(""); }} />
              </div>
              <Button type="submit" disabled={sending || pin.length !== 4} className="h-12 w-full">Send {money(review.amount)}</Button>
            </form>
          ) : <Button className="h-11 w-full" onClick={() => navigate("/settings?tab=security")}>Set a transaction PIN</Button>}
        </Card>
      </WalletFlow>
    );
  }

  return (
    <WalletFlow title="Send money" description={<>Available balance <strong className="ml-1 font-semibold text-white">{money(balance)}</strong></>}>
      <Card className="rounded-2xl p-4 sm:p-6">
        <form onSubmit={continueToReview} className="space-y-4" noValidate>
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
            <p className="text-xs text-muted-foreground">{amountValid ? `${money(feeFor(numericAmount))} transfer fee · ${money(total)} total` : "₦100 minimum · ₦500,000 maximum"}</p>
          </div>
          <details className="rounded-xl border px-3">
            <summary className="app-disclosure font-medium">Add a note <span className="text-xs text-muted-foreground">Optional</span></summary>
            <div className="pb-3"><Input aria-label="Transfer note" value={note} maxLength={100} onChange={(event) => setNote(event.target.value)} /></div>
          </details>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full gap-2" disabled={Boolean(key && !verified)}>Review transfer <ArrowRight size={16} aria-hidden="true" /></Button>
        </form>
      </Card>
    </WalletFlow>
  );
}
