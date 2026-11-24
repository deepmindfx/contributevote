import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supportLink } from "@/services/supabase/supportService";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, Clock3, LockKeyhole, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { hasTransactionPin } from "@/lib/transactionPin";
import {
  getFixedSavings, openSavings, quoteSavings, reviewSavingsTerms, SavingsConfirmationRejected, savingsPeriods, withdrawSavings,
  type SavingsCursor, type SavingsItem, type SavingsPeriod, type SavingsQuote,
} from "@/services/supabase/fixedSavingsService";
import { naira } from "@/services/supabase/pricingService";
import "@/styles/fixed-savings.css";

const day = 86_400_000;
const ngDate = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
  timeZone: "Africa/Lagos", timeZoneName: "short",
});

function timeRemaining(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  if (hours >= 24) return Math.floor(hours / 24) + "d " + (hours % 24) + "h remaining";
  return hours + "h " + Math.floor(total / 60) % 60 + "m " + total % 60 + "s remaining";
}

function SavingsIce({ progress = 0, thawed = false, hero = false }: { progress?: number; thawed?: boolean; hero?: boolean }) {
  return <div
    className={"savings-ice" + (hero ? " savings-ice--hero" : "") + (thawed ? " savings-ice--thawed" : "")}
    style={{ "--ice-progress": Math.max(0, Math.min(1, progress)) } as CSSProperties}
    aria-hidden="true"
  >
    {!hero && <img className="savings-ice-open" src="/images/fixed-savings-thawed.webp" alt="" width={768} height={512} loading="lazy" />}
    <img className="savings-ice-frozen" src="/images/fixed-savings-frozen.webp" alt="" width={768} height={512} loading={hero ? "eager" : "lazy"} />
    {!hero && <span className="savings-ice-crack" />}
  </div>;
}

function canWithdrawLock(item: SavingsItem, now: number) {
  if (item.credited_at) return false;
  return item.status === "matured" || (item.settlement_mode === "wallet_ledger" &&
    item.status === "active" && Date.parse(item.maturity_at) <= now);
}

function LockCard({ item, now, onWithdraw, busy }: { item: SavingsItem; now: number; onWithdraw: (id: string) => void; busy: boolean }) {
  const start = Date.parse(item.locked_at || item.requested_at);
  const remaining = Date.parse(item.maturity_at) - now;
  const released = item.status === "matured" || item.status === "withdrawn";
  const approaching = item.status === "active" && remaining <= day;
  const readyToWithdraw = canWithdrawLock(item, now);
  const label = item.status === "reserving" ? "Confirming lock" : item.status === "failed" ? "Returned to wallet"
    : readyToWithdraw || item.status === "matured" ? "Matured" : item.status === "withdrawn" ? "Withdrawn to wallet"
    : approaching ? "Maturing" : "Active";
  const progress = released ? 1 : Math.max(0, Math.min(1, (now - start) / Math.max(1, Date.parse(item.maturity_at) - start)));

  return <Card className="min-w-0 overflow-hidden rounded-2xl">
    {item.status !== "failed" && <SavingsIce progress={progress} thawed={released || readyToWithdraw} />}
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-words text-xl font-semibold tabular-nums">{naira.format(item.amount)}</p>
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">{label}</span>
      </div>
      <dl className="space-y-2 text-xs">
        <div className="flex flex-wrap justify-between gap-1 text-muted-foreground"><dt>{item.locked_at ? "Locked on" : "Requested on"}</dt><dd>{ngDate.format(new Date(start))}</dd></div>
        <div className="flex flex-wrap justify-between gap-1 text-muted-foreground"><dt>Maturity</dt><dd>{ngDate.format(new Date(item.maturity_at))}</dd></div>
      </dl>
      {item.status === "active" && !readyToWithdraw && <div className="space-y-2">
        <progress className="savings-progress block h-1 w-full" max={1} value={progress} aria-label="Lock period elapsed" />
        <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums"><Clock3 size={13} aria-hidden="true" />
          {remaining <= 0 ? "Waiting for release confirmation" : timeRemaining(remaining)}
        </p>
      </div>}
      {readyToWithdraw && <Button className="h-11 w-full gap-2" disabled={busy} onClick={() => onWithdraw(item.id)}>
        <ArrowDownToLine size={16} aria-hidden="true" /> {busy ? "Withdrawing…" : "Withdraw to wallet"}
      </Button>}
      {item.credited_at && <>
        <p className="text-xs text-muted-foreground">Credited to wallet {ngDate.format(new Date(item.credited_at))}</p>
        <Button asChild variant="outline" className="h-11 w-full gap-2">
          <Link to="/transfer">Transfer to bank <ArrowRight size={16} aria-hidden="true" /></Link>
        </Button>
      </>}
      {(readyToWithdraw || item.status === "reserving" || item.status === "failed") &&
        <Link className="inline-flex min-h-9 items-center text-xs font-medium text-primary underline-offset-4 hover:underline" to={supportLink("ice_vault", item.id)}>Get help with this lock</Link>}
    </div>
  </Card>;
}

function termsLink(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function recoverQuote(owner: string): SavingsQuote | null {
  try {
    const quote = JSON.parse(sessionStorage.getItem("collectipay-savings-quote:" + owner) || "null") as SavingsQuote | null;
    return quote?.id && quote.maturity_at && quote.terms_version && termsLink(quote.terms_url) ? quote : null;
  } catch { return null; }
}

export default function FixedSavings() {
  const { user } = useSupabaseUser();
  return user ? <AccountSavings key={user.id} owner={user.id} /> : null;
}

function AccountSavings({ owner }: { owner: string }) {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(() => recoverQuote(owner));
  const [amount, setAmount] = useState(() => quote ? String(quote.amount) : "");
  const [days, setDays] = useState<SavingsPeriod>(() => quote?.days ?? 30);
  const [pendingConfirmation, setPendingConfirmation] = useState(() => Boolean(quote));
  const [showReview, setShowReview] = useState(false);
  const [checkingQuote, setCheckingQuote] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [reviewedTermsFor, setReviewedTermsFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const commitGuard = useRef(false);
  const quoteGuard = useRef(false);
  const withdrawGuard = useRef(false);
  const [tick, setTick] = useState(Date.now);
  const cacheKey = ["workspace", owner, "fixed-savings"] as const;
  const query = useInfiniteQuery({
    queryKey: cacheKey, initialPageParam: null as SavingsCursor | null,
    queryFn: ({ pageParam, signal }) => getFixedSavings(pageParam, signal),
    getNextPageParam: (last) => {
      const item = last.items[last.items.length - 1];
      return last.items.length === 24 && item ? { before: item.requested_at, id: item.id } : undefined;
    },
    refetchInterval: (current) => {
      const pages = current.state.data?.pages ?? [];
      const firstPage = pages[0];
      if (!firstPage) return false;
      const serverNow = Date.parse(firstPage.server_now) + Math.max(0, Date.now() - firstPage.received_at);
      const candidates = pages[0]?.open_items ?? pages.flatMap((page) => page.items);
      return candidates.some((item) => item.status === "reserving" ||
        (item.status === "active" && Date.parse(item.maturity_at) - serverNow < day)) ? 15_000 : false;
    },
  });
  const first = query.data?.pages[0];
  const periods = first?.limits?.allowed_days ?? savingsPeriods;
  const selectedPeriod = periods.includes(days) ? days : periods[0];
  const minimum = first?.limits?.min_amount ?? 1;
  const maximum = first?.limits?.max_amount;
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const unsettledItems = first?.open_items ?? items.filter((item) => item.status !== "failed" && !item.credited_at);
  const existingQuote = quote && (unsettledItems.some((item) => item.id === quote.id) || items.some((item) => item.id === quote.id));
  const now = first ? Date.parse(first.server_now) + Math.max(0, tick - first.received_at) : tick;
  const canTick = showReview || unsettledItems.some((item) => item.status === "active");
  const canStart = Boolean(first?.enabled && user?.status === "active");
  const pinSet = hasTransactionPin(user?.preferences);

  useEffect(() => {
    if (!canTick) return;
    setTick(Date.now());
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [canTick]);

  const clearSavedQuote = useCallback(() => {
    try { sessionStorage.removeItem("collectipay-savings-quote:" + owner); } catch { /* Storage may be unavailable. */ }
    setPendingConfirmation(false);
    setQuote(null);
    setShowReview(false);
    setPin("");
    setAccepted(false);
    setReviewedTermsFor(null);
    setActionError("");
  }, [owner]);

  useEffect(() => {
    if (!existingQuote || committing) return;
    clearSavedQuote();
    setAmount("");
  }, [existingQuote, committing, clearSavedQuote]);

  const refresh = () => Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: cacheKey }), refreshCurrentUser(), refreshContributionData(true),
  ]);

  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (quoteGuard.current) return;
    if (quote && (pendingConfirmation || (canStart && Date.parse(quote.expires_at) > now))) {
      setShowReview(true);
      return;
    }
    if (!canStart) return;
    const value = Number(amount);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !Number.isFinite(value) ||
        value < minimum || (maximum != null && value > maximum)) {
      toast.error(maximum ? `Enter an amount between ${naira.format(minimum)} and ${naira.format(maximum)}.` : `Enter at least ${naira.format(minimum)}.`);
      return;
    }
    quoteGuard.current = true;
    setCheckingQuote(true);
    setActionError("");
    try {
      setQuote(await quoteSavings(value, selectedPeriod));
      setAccepted(false);
      setReviewedTermsFor(null);
      setShowReview(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t prepare the lock.");
    } finally { quoteGuard.current = false; setCheckingQuote(false); }
  };

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quote || (!pendingConfirmation && Date.parse(quote.expires_at) <= now) || !termsLink(quote.terms_url) ||
        reviewedTermsFor !== quote.id || !accepted || !/^\d{4}$/.test(pin) || commitGuard.current) return;
    commitGuard.current = true;
    setCommitting(true);
    setActionError("");
    try {
      setPendingConfirmation(true);
      try { sessionStorage.setItem("collectipay-savings-quote:" + owner, JSON.stringify(quote)); } catch { /* Storage may be unavailable. */ }
      const status = await openSavings(quote, true, pin);
      clearSavedQuote();
      setAmount("");
      toast.success(status === "active" ? "Your savings are locked."
        : status === "reserving" ? "Savings lock submitted. We’ll notify you when it’s confirmed."
        : "Savings status updated.");
      void refresh();
    } catch (error) {
      if (error instanceof SavingsConfirmationRejected) {
        if (error.code === "stale_quote") {
          clearSavedQuote();
          toast.error(error.message);
          void query.refetch();
          return;
        }
        try { sessionStorage.removeItem("collectipay-savings-quote:" + owner); } catch { /* Storage may be unavailable. */ }
        setPendingConfirmation(false);
      }
      setPin("");
      setActionError(error instanceof Error ? error.message : "Couldn’t confirm the lock. Retry this quote.");
      void query.refetch();
    } finally {
      commitGuard.current = false;
      setCommitting(false);
    }
  };

  const withdraw = async (id: string) => {
    if (withdrawGuard.current) return;
    withdrawGuard.current = true;
    setWithdrawingId(id);
    try {
      await withdrawSavings(id);
      toast.success("Your savings are now in your wallet.", {
        action: { label: "Transfer to bank", onClick: () => navigate("/transfer") },
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t move funds to your wallet.");
      void query.refetch();
    }
    finally { withdrawGuard.current = false; setWithdrawingId(null); }
  };

  const approvedTerms = quote ? termsLink(quote.terms_url) : null;
  const markTermsOpened = async (openingQuote: SavingsQuote) => {
    try {
      await reviewSavingsTerms(openingQuote);
      setReviewedTermsFor(openingQuote.id);
      setActionError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn’t record your terms review. Try opening the terms again.");
    }
  };
  const quoteExpired = Boolean(quote && Date.parse(quote.expires_at) <= now);
  const dueItems = unsettledItems.filter((item) => canWithdrawLock(item, now));
  const openItems = unsettledItems.filter((item) => !canWithdrawLock(item, now));
  const history = items.filter((item) => item.status === "failed" || Boolean(item.credited_at));
  const dueActive = dueItems.filter((item) => item.status === "active");
  const dueBalance = dueActive.reduce((cents, item) => cents + Math.round(item.amount * 100), 0) / 100;
  const locked = Math.max(0, (first?.totals.locked ?? 0) - dueBalance);
  const activeCount = Math.max(0, (first?.totals.active_count ?? 0) - dueActive.length);
  const available = (first?.totals.available ?? 0) + dueBalance;

  return (
    <WalletFlow title="Ice Vault" wide description="Set money aside until a date you choose. Your principal stays the same.">
      <div className="fixed-savings-page space-y-5">
        <section className="savings-summary rounded-3xl" aria-label="Ice Vault summary">
          <SavingsIce hero />
          <div className="savings-summary-copy">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-100"><Snowflake size={15} aria-hidden="true" /> Total locked</span>
            <p className="break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{first ? naira.format(locked) : "—"}</p>
            {first && <p className="text-sm text-emerald-100">{activeCount} active {activeCount === 1 ? "lock" : "locks"}</p>}
          </div>
        </section>
        {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading savings…</p> : query.isError && !first ? (
          <Card className="space-y-3 p-4"><p role="alert">Couldn’t load Ice Vault.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></Card>
        ) : <>
          {dueItems.length > 0 && <section className="space-y-3" aria-labelledby="savings-ready-title">
            <h2 id="savings-ready-title" className="app-section-title">Ready to withdraw</h2>
            <p className="text-sm text-muted-foreground">These locks have matured. You can return the full amount to your wallet now.</p>
            <div className="grid gap-3 sm:grid-cols-2">{dueItems.map((item) => <LockCard key={item.id} item={item} now={now} onWithdraw={(id) => void withdraw(id)} busy={withdrawingId === item.id} />)}</div>
          </section>}
          {first && (first.totals.pending > 0 || available > 0) && <dl className="grid grid-cols-2 gap-3 text-sm">
            {first.totals.pending > 0 && <Card className="p-3"><dt className="text-muted-foreground">Awaiting confirmation</dt><dd className="font-semibold">{naira.format(first.totals.pending)}</dd></Card>}
            {available > 0 && <Card className="p-3"><dt className="text-muted-foreground">Available to claim</dt><dd className="font-semibold">{naira.format(available)}</dd></Card>}
          </dl>}
          {(canStart && pinSet) || pendingConfirmation ? <Card className="rounded-2xl p-4 sm:p-5">
            <form className="space-y-4" onSubmit={review}>
              <h2 className="app-section-title">Lock money</h2>
              <div className="space-y-1.5">
                <Label htmlFor="savings-amount">Amount in naira</Label>
                <Input id="savings-amount" className="h-12" inputMode="decimal" placeholder="0.00" value={amount} disabled={checkingQuote || pendingConfirmation} onChange={(event) => {
                  if (quote) clearSavedQuote();
                  setAmount(event.target.value);
                }} required={!quote || quoteExpired} />
                <p className="text-xs text-muted-foreground">{naira.format(Number(user?.wallet_balance || 0))} available in your wallet</p>
                {maximum != null && <p className="text-xs text-muted-foreground">Per lock {naira.format(minimum)} to {naira.format(maximum)}</p>}
              </div>
              <fieldset className="space-y-2" disabled={checkingQuote || pendingConfirmation}>
                <legend className="text-sm font-medium">Lock period</legend>
                <div className="flex flex-wrap gap-2">{periods.map((period) =>
                  <label key={period} className="savings-period"><input type="radio" name="savings-period" value={period} checked={period === selectedPeriod} onChange={() => {
                    if (quote) clearSavedQuote();
                    setDays(period);
                  }} />
                    <span>{period} days</span></label>)}</div>
              </fieldset>
              <Button type="submit" className="h-11 w-full gap-2" disabled={checkingQuote}>{checkingQuote ? "Checking…" : pendingConfirmation ? "Check submitted lock" : quote && !quoteExpired ? "Resume review" : "Review lock"}<ArrowRight size={16} aria-hidden="true" /></Button>
            </form>
          </Card> : <Card className="space-y-2 rounded-2xl p-4">
            <div className="flex items-center gap-2"><LockKeyhole size={16} aria-hidden="true" /><h2 className="font-medium">{canStart ? "Set a transaction PIN" : "New savings locks are unavailable"}</h2></div>
            <p className="text-sm text-muted-foreground">{canStart ? "Your PIN is required to lock money." : "You can still review existing locks and move matured funds to your wallet."}</p>
            {canStart && <Button asChild variant="outline"><Link to="/settings">Open security settings</Link></Button>}
          </Card>}
          {[["Your locks", openItems], ["Savings history", history]].map(([title, list]) => {
            const cards = list as SavingsItem[];
            return cards.length > 0 && <section key={String(title)} className="space-y-3">
              <h2 className="app-section-title">{String(title)}</h2>
              <div className="grid gap-3 sm:grid-cols-2">{cards.map((item) => <LockCard key={item.id} item={item} now={now} onWithdraw={(id) => void withdraw(id)} busy={withdrawingId === item.id} />)}</div>
            </section>;
          })}
          {query.hasNextPage && <Button variant="outline" className="h-11 w-full" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load older savings</Button>}
        </>}
      </div>
      <Dialog open={showReview && Boolean(quote)} onOpenChange={(open) => { if (!committing) setShowReview(open); }}>
        {quote && <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg max-h-[88dvh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Review your savings lock</DialogTitle><DialogDescription>Check the amount and maturity time.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={confirm}>
            <dl className="space-y-2 rounded-xl bg-muted p-3 text-sm">
              <div className="flex items-center justify-between gap-2"><dt>Principal</dt><dd className="font-semibold">{naira.format(quote.amount)}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt>Matures at</dt><dd className="font-semibold">{ngDate.format(new Date(quote.maturity_at))}</dd></div>
            </dl>
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <LockKeyhole size={17} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">No early release</p>
                <p>Once you confirm, you can’t cancel this lock, withdraw the money early, or appeal for early release.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.settlement_mode === "wallet_ledger"
                ? "The full amount returns to your wallet automatically at maturity."
                : "Your provider confirms release after maturity."} Ice Vault pays no interest or bonuses.
            </p>
            {approvedTerms ? <a href={approvedTerms} target="_blank" rel="noopener noreferrer" onClick={() => void markTermsOpened(quote)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4">
              Read Ice Vault terms <ArrowRight size={14} aria-hidden="true" />
            </a> : <p role="status" className="text-sm text-muted-foreground">The terms are unavailable. Review a new quote.</p>}
            <label className="flex gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={accepted} disabled={!approvedTerms || reviewedTermsFor !== quote.id || committing} onChange={(event) => setAccepted(event.target.checked)} />
              <span>I accept the Ice Vault terms and agree to lock this amount until the maturity time shown above.</span>
            </label>
            {approvedTerms && reviewedTermsFor !== quote.id && <p className="text-xs text-muted-foreground">Open the terms to enable the checkbox.</p>}
            <div className="space-y-1.5"><Label htmlFor="savings-pin">Transaction PIN</Label>
              <Input id="savings-pin" className="h-11" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} disabled={committing} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
            </div>
            {actionError && <p className="text-sm text-destructive" role="alert">{actionError}</p>}
            {quoteExpired && <p className="text-sm text-muted-foreground">{pendingConfirmation ? "Check this submission before starting another lock." : "This quote expired. Return to the form to request a new quote."}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={pendingConfirmation ? () => setShowReview(false) : clearSavedQuote} disabled={committing}>Close review</Button>
              <Button type="submit" disabled={committing || !accepted || !approvedTerms || reviewedTermsFor !== quote.id || pin.length !== 4 || (quoteExpired && !pendingConfirmation)}>{committing ? "Confirming…" : pendingConfirmation ? "Retry confirmation" : "Confirm lock"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>}
      </Dialog>
    </WalletFlow>
  );
}
