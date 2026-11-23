import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, ChevronDown, Copy, Download, FileSpreadsheet, LoaderCircle, UploadCloud, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bulkMoney } from "@/components/wallet/BulkTransferDetails";
import { BulkTransferRecipientsForm } from "@/components/wallet/BulkTransferRecipientsForm";
import { useBankDirectory } from "@/hooks/useBankDirectory";
import { BULK_CSV_MAX_BYTES, PAYROLL_CSV_NAME, PAYROLL_CSV_URL, parseBulkTransferCsv } from "@/lib/bulkTransfers";
import type { BulkRecipientInput } from "@/lib/bulkTransfers";
import { cn } from "@/lib/utils";
import type { BulkTransferSettings } from "@/services/supabase/bulkTransferService";

type CsvUpload =
  | { status: "reading"; name: string }
  | { status: "invalid"; name: string; error: string }
  | { status: "ready"; name: string; recipients: BulkRecipientInput[]; principal: number };

type UploadProps = {
  settings: BulkTransferSettings;
  busy: boolean;
  error: string;
  onEdit: () => void;
  onReview: (title: string, recipients: BulkRecipientInput[]) => Promise<void>;
};

export function BulkTransferUpload(props: UploadProps) {
  const [mode, setMode] = useState("manual");
  return (
    <Tabs value={mode} onValueChange={(next) => { setMode(next); props.onEdit(); }}>
      <TabsList className="mb-2 grid h-11 w-full grid-cols-2 rounded-xl" aria-label="Choose how to add recipients">
        <TabsTrigger value="manual" className="gap-1.5 rounded-lg" disabled={props.busy}><UsersRound size={16} aria-hidden="true" /> Add recipients</TabsTrigger>
        <TabsTrigger value="csv" className="gap-1.5 rounded-lg" disabled={props.busy}><FileSpreadsheet size={16} aria-hidden="true" /> Import CSV</TabsTrigger>
      </TabsList>
      <TabsContent value="manual" forceMount className="data-[state=inactive]:hidden">
        <BulkTransferRecipientsForm {...props} active={mode === "manual"} />
      </TabsContent>
      <TabsContent value="csv" forceMount className="data-[state=inactive]:hidden">
        <BulkTransferCsvUpload {...props} active={mode === "csv"} />
      </TabsContent>
    </Tabs>
  );
}

function BulkTransferCsvUpload({ settings, active, busy, error, onEdit, onReview }: UploadProps & { active: boolean }) {
  const [upload, setUpload] = useState<CsvUpload>();
  const [title, setTitle] = useState("");
  const selectedFile = useRef(0);
  const banks = useBankDirectory(active);
  const fileDisabled = busy || !banks.data;

  const useFile = async (file?: File) => {
    if (!file || busy || !banks.data) return;
    const selection = ++selectedFile.current;
    onEdit();
    setUpload({ status: "reading", name: file.name });
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a .csv file.");
      if (file.size > BULK_CSV_MAX_BYTES) throw new Error("Choose a CSV file up to 100 KB.");
      const recipients = parseBulkTransferCsv(await file.text(), banks.data);
      if (selectedFile.current !== selection) return;
      const principal = recipients.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
      setUpload({ status: "ready", name: file.name, recipients, principal });
      setTitle((name) => name.trim() ? name : file.name.slice(0, -4).trim().slice(0, 80));
    } catch (err) {
      if (selectedFile.current !== selection) return;
      setUpload({ status: "invalid", name: file.name, error: err instanceof Error ? err.message : "Couldn’t read this CSV." });
    }
  };

  const ready = upload?.status === "ready" ? upload : undefined;
  const limitError = ready && ready.recipients.length > settings.max_recipients
    ? `This batch can contain up to ${settings.max_recipients} recipients.`
    : ready && ready.principal > settings.max_batch_amount
      ? `Recipient amounts must total ${bulkMoney(settings.max_batch_amount)} or less.`
      : "";
  const issue = upload?.status === "invalid" ? upload.error : limitError || error;
  const canReview = Boolean(ready && !busy && !limitError && title.trim());

  const review = (event: FormEvent) => {
    event.preventDefault();
    if (ready && canReview) void onReview(title.trim(), ready.recipients);
  };

  return (
    <Card className="overflow-hidden rounded-3xl">
      <form onSubmit={review}>
        <div className="space-y-4 p-4 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight">New batch</h2>
              <PayrollCsvDownload />
            </div>
            <p id="bulk-file-instructions" className="mt-1 text-sm text-muted-foreground">
              Import up to {settings.max_recipients} recipients. Use the bank name shown in the directory.
            </p>
          </div>
          {!banks.data && (banks.isError ? <div className="flex flex-wrap items-center gap-2 text-sm">
            <p role="alert">Couldn’t load the bank directory.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void banks.refetch()}>Retry</Button>
          </div> : <p role="status" className="text-sm text-muted-foreground">Loading banks…</p>)}
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            void useFile(event.dataTransfer.files[0]);
          }}>
            <input id="recipient-csv" type="file" accept=".csv,text/csv" disabled={fileDisabled}
              aria-describedby={issue ? "bulk-file-instructions bulk-file-error" : "bulk-file-instructions"}
              className="peer sr-only" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void useFile(file);
              }} />
            <label htmlFor="recipient-csv" className={cn(
              "flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-accent/35 p-4 transition-colors hover:border-primary hover:bg-accent/65 peer-focus-visible:ring-2 peer-focus-visible:ring-ring sm:p-5",
              fileDisabled && "pointer-events-none opacity-60",
            )}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-12">
                {upload?.status === "reading"
                  ? <LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden="true" />
                  : ready ? <FileSpreadsheet size={20} aria-hidden="true" /> : <UploadCloud size={20} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1" aria-live="polite">
                <span className="block break-all text-sm font-semibold">{upload?.name ?? "Choose a CSV file"}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {upload?.status === "reading" ? "Reading file…"
                    : ready ? `${ready.recipients.length} recipients · ${bulkMoney(ready.principal)} before fees`
                    : upload ? "Choose a replacement file" : <><span className="hidden sm:inline">Drop a file here · </span>Up to 100 KB</>}
                </span>
              </span>
              {ready && <span className="shrink-0 text-xs font-semibold text-primary">Replace</span>}
            </label>
          </div>
          {ready && <div className="space-y-1.5">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input id="batch-name" required value={title} onChange={(event) => { setTitle(event.target.value); onEdit(); }}
              maxLength={80} placeholder="Monthly salaries" disabled={busy} className="h-11 rounded-xl" />
          </div>}
          {issue && <p id="bulk-file-error" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-foreground">{issue}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/25 px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">Bank details and fees are checked before you send.</p>
          <Button type="submit" size="lg" disabled={!canReview} className="h-11 w-full gap-2 rounded-xl sm:w-auto">
            {busy ? <><LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> Verifying recipients…</> : <>Review batch <ArrowRight size={16} aria-hidden="true" /></>}
          </Button>
        </div>
      </form>
      <div className="border-t px-4 py-3 sm:px-6"><BulkCsvGuide /></div>
    </Card>
  );
}

export function BulkTransferCsvHelp() {
  return (
    <Card className="space-y-3 rounded-2xl p-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-primary"><FileSpreadsheet size={18} aria-hidden="true" /></span>
          <div>
            <h2 className="text-sm font-semibold">Payroll CSV example</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Replace the sample details with your own recipients.</p>
          </div>
        </div>
        <PayrollCsvDownload />
      </div>
      <BulkCsvGuide />
    </Card>
  );
}

function PayrollCsvDownload() {
  return (
    <Button asChild variant="outline" size="sm" className="h-10 gap-2 rounded-xl">
      <a href={PAYROLL_CSV_URL} download={PAYROLL_CSV_NAME} aria-label="Download payroll CSV example">
        <Download size={16} aria-hidden="true" /> CSV example
      </a>
    </Button>
  );
}

function BulkCsvGuide() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const banks = useBankDirectory(open);
  const term = search.trim().toLowerCase();
  const matches = banks.data?.filter(({ name, code }) => name.toLowerCase().includes(term) || String(code).includes(term));
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="group rounded-xl border px-3 text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
        CSV format and bank names <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {open && <div className="space-y-2 pb-3">
        <code className="block rounded-lg bg-muted/70 p-2 text-xs [overflow-wrap:anywhere]">bank_name,account_number,amount,narration</code>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">Copy the bank name below. Format account numbers as text to keep leading zeros. Older files with a bank code column also work.</p>
        <Input aria-label="Search bank names" placeholder="Search for a bank" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-lg" />
        {banks.isPending && <p role="status" className="text-xs text-muted-foreground">Loading banks…</p>}
        {banks.isError && <Button type="button" variant="outline" size="sm" onClick={() => void banks.refetch()}>Reload banks</Button>}
        {matches?.length === 0 && <p className="text-xs text-muted-foreground">No matching banks.</p>}
        <ul className="max-h-40 divide-y overflow-y-auto pr-2" aria-label="Bank names">
          {matches?.map(({ name, code }) => (
            <li key={code} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 break-words">{name}</span>
              <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Copy ${name}`}
                onClick={async () => {
                  try { await navigator.clipboard.writeText(name); toast.success("Bank name copied"); }
                  catch { toast.error("Couldn’t copy the bank name."); }
                }}><Copy size={15} aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      </div>}
    </details>
  );
}
