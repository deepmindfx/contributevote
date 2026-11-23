import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Check, ChevronRight, History, ListChecks, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { BulkTransferDetails, bulkMoney, bulkStatus } from "@/components/wallet/BulkTransferDetails";
import { BulkTransferCsvHelp, BulkTransferUpload } from "@/components/wallet/BulkTransferUpload";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import type { BulkRecipientInput } from "@/lib/bulkTransfers";
import { cn } from "@/lib/utils";
import { getBulkTransferBatch, getBulkTransferHistory, getBulkTransferSettings, runBulkTransfer } from "@/services/supabase/bulkTransferService";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const batchDate = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", month: "short", day: "numeric" });
const steps = [
  { label: "Upload", icon: UploadCloud },
  { label: "Review", icon: ListChecks },
  { label: "Track", icon: Activity },
];

function BulkTransferSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Bulk transfer progress" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/65 p-1">
      {steps.map(({ label, icon: Icon }, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined}
          className={cn("flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-xs font-medium sm:text-sm",
            index === current ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
          {index < current ? <Check size={15} className="shrink-0 text-primary" aria-hidden="true" /> : <Icon size={15} className="shrink-0" aria-hidden="true" />}
          {label}
        </li>
      ))}
    </ol>
  );
}

export default function BulkTransfer() {
  const [params, setParams] = useSearchParams();
  const candidate = params.get("batch") ?? "";
  const id = uuid.test(candidate) ? candidate : undefined;
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const action = useRef(false);
  const previousId = useRef(id);
  const stage = useRef<HTMLDivElement>(null);
  const key = ["workspace", user?.id, "bulk-transfers"] as const;
  const settings = useQuery({ queryKey: [...key, "settings"], queryFn: getBulkTransferSettings });
  const history = useQuery({ queryKey: [...key, "history"], queryFn: () => getBulkTransferHistory(), enabled: !id });
  const detail = useQuery({
    queryKey: [...key, id], queryFn: () => getBulkTransferBatch(id!), enabled: Boolean(id),
    refetchInterval: (query) => query.state.data?.pending ? 8_000 : false,
  });
  const batch = detail.data;

  const refreshWallet = () => {
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: [...key, "history"] }),
      refreshCurrentUser(),
      refreshContributionData(true),
    ]);
  };

  useEffect(() => {
    if (previousId.current === id) return;
    previousId.current = id;
    stage.current?.focus();
  }, [id]);

  const review = async (title: string, recipients: BulkRecipientInput[]) => {
    if (action.current || !settings.data?.enabled) return;
    action.current = true;
    setBusy(true);
    setError("");
    try {
      const batchId = await runBulkTransfer({ action: "quote", title, recipients });
      setParams({ batch: batchId });
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t prepare this batch."); }
    finally { action.current = false; setBusy(false); }
  };

  const submit = async (pin?: string) => {
    if (!id || action.current) return;
    action.current = true;
    setBusy(true);
    setError("");
    try {
      await runBulkTransfer({ action: "submit", batch_id: id, transaction_pin: pin });
      setPinOpen(false);
      await detail.refetch();
      refreshWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn’t confirm this batch.";
      await detail.refetch();
      if (pin) throw new Error(message);
      setError(message);
    } finally { action.current = false; setBusy(false); }
  };

  const reconcile = async () => {
    if (!id || action.current) return;
    action.current = true;
    setBusy(true);
    try {
      await runBulkTransfer({ action: "reconcile", batch_id: id });
      await detail.refetch();
      refreshWallet();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn’t check provider status."); }
    finally { action.current = false; setBusy(false); }
  };

  return (
    <WalletFlow title="Bulk transfers" description="Pay multiple Nigerian bank accounts with one approval." wide
      headerRight={<Button asChild variant="outline" size="sm" className="app-panel-secondary"><Link to="/transfer">Single transfer</Link></Button>}>
      <div ref={stage} tabIndex={-1} role="region" className="space-y-4 outline-none" aria-label="Bulk transfer workspace">
        <BulkTransferSteps current={batch?.authorized_at ? 2 : id ? 1 : 0} />
        {id ? <>
          <Button type="button" variant="ghost" className="h-10 gap-2 px-3" disabled={busy} onClick={() => { setError(""); setParams({}); }}>
            <ArrowLeft size={16} aria-hidden="true" /> All batches
          </Button>
          {detail.isPending && <p role="status">Loading batch…</p>}
          {detail.isError && <Card className="space-y-3 p-4"><p>Couldn’t load this batch.</p><Button type="button" onClick={() => void detail.refetch()}>Try again</Button></Card>}
          {batch && <>
            <BulkTransferDetails batch={batch} actions={
              batch.status === "quoted" || batch.status === "reserved" || batch.pending > 0 ? <>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {batch.status === "quoted" && <Button type="button" size="lg" className="w-full rounded-xl" disabled={busy || !settings.data?.enabled} onClick={() => setPinOpen(true)}>Confirm {bulkMoney(batch.total)}</Button>}
                {batch.status === "reserved" && <Button type="button" size="lg" className="w-full rounded-xl" disabled={busy || !settings.data?.enabled} onClick={() => void submit()}>Continue authorized batch</Button>}
                {batch.pending > 0 && batch.status !== "reserved" && (
                  <Button type="button" variant="outline" size="lg" className="w-full gap-2 rounded-xl" disabled={busy} onClick={() => void reconcile()}>
                    <RefreshCw size={16} className={cn(busy && "motion-safe:animate-spin")} aria-hidden="true" /> {busy ? "Checking status…" : "Refresh transfer status"}
                  </Button>
                )}
              </> : undefined
            } />
            {batch.status === "expired" && <p className="text-sm text-muted-foreground">Return to all batches and upload your CSV again to get an updated quote.</p>}
            <TransactionPinDialog open={pinOpen && batch.status === "quoted"} onOpenChange={setPinOpen} pending={busy} amount={batch.total}
              title="Authorize bulk transfer" description={`Confirm the full amount for ${batch.recipient_count} recipients, including all fees and VAT.`}
              confirmLabel="Send batch" onVerified={submit} />
          </>}
        </> : <>
          {settings.data?.enabled ? (
            <BulkTransferUpload settings={settings.data} busy={busy} error={error} onEdit={() => setError("")} onReview={review} />
          ) : settings.isPending ? <p role="status">Loading bulk transfers…</p>
            : <Card className="space-y-3 p-4"><p>{settings.isError ? "Couldn’t load bulk transfers." : "New bulk transfers are currently paused."}</p>
              {settings.isError && <Button type="button" variant="outline" onClick={() => void settings.refetch()}>Try again</Button>}</Card>}
          {!settings.isPending && !settings.data?.enabled && <BulkTransferCsvHelp />}
          <Card className="space-y-3 rounded-2xl p-4 sm:px-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><History size={17} className="text-primary" aria-hidden="true" /> Recent batches</h2>
            {history.isPending && <p role="status" className="text-sm text-muted-foreground">Loading batches…</p>}
            {history.isError && <Button type="button" variant="outline" size="sm" onClick={() => void history.refetch()}>Reload history</Button>}
            {history.data?.length === 0 && <p className="text-sm text-muted-foreground">Your sent batches will appear here.</p>}
            {!!history.data?.length && <ul className="divide-y">{history.data.map((entry) => (
              <li key={entry.id}>
                <Link className="flex items-center gap-2 rounded-lg py-3 hover:bg-muted/55 focus-visible:outline-ring sm:gap-3" to={`?batch=${entry.id}`}>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {entry.title}
                    <span className="mt-0.5 block text-xs font-normal leading-relaxed text-muted-foreground">
                      {entry.authorized_at && `${batchDate.format(new Date(entry.authorized_at))} · `}{bulkStatus(entry.status)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{bulkMoney(entry.total)}</span>
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}</ul>}
          </Card>
        </>}
      </div>
    </WalletFlow>
  );
}
