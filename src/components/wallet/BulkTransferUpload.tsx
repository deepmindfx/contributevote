import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Download, FileSpreadsheet, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkMoney } from "@/components/wallet/BulkTransferDetails";
import { BULK_CSV_MAX_BYTES, PAYROLL_CSV_NAME, PAYROLL_CSV_URL, parseBulkTransferCsv } from "@/lib/bulkTransfers";
import type { BulkRecipientInput } from "@/lib/bulkTransfers";
import { cn } from "@/lib/utils";
import { SupabaseApiService } from "@/services/supabase/apiService";
import type { BankOption } from "@/services/supabase/beneficiaryService";
import type { BulkTransferSettings } from "@/services/supabase/bulkTransferService";

type CsvUpload =
  | { status: "reading"; name: string }
  | { status: "invalid"; name: string; error: string }
  | { status: "ready"; name: string; recipients: BulkRecipientInput[]; principal: number };

export function BulkTransferUpload({ settings, busy, error, onEdit, onReview }: {
  settings: BulkTransferSettings;
  busy: boolean;
  error: string;
  onEdit: () => void;
  onReview: (title: string, recipients: BulkRecipientInput[]) => Promise<void>;
}) {
  const [upload, setUpload] = useState<CsvUpload>();
  const [title, setTitle] = useState("");
  const selectedFile = useRef(0);

  const useFile = async (file?: File) => {
    if (!file || busy) return;
    const selection = ++selectedFile.current;
    onEdit();
    setUpload({ status: "reading", name: file.name });
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a .csv file.");
      if (file.size > BULK_CSV_MAX_BYTES) throw new Error("Choose a CSV file up to 100 KB.");
      const recipients = parseBulkTransferCsv(await file.text());
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
              Upload a CSV with 2–{settings.max_recipients} recipients, up to {bulkMoney(settings.max_batch_amount)} per batch.
            </p>
          </div>
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            void useFile(event.dataTransfer.files[0]);
          }}>
            <input id="recipient-csv" type="file" accept=".csv,text/csv" disabled={busy}
              aria-describedby={issue ? "bulk-file-instructions bulk-file-error" : "bulk-file-instructions"}
              className="peer sr-only" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void useFile(file);
              }} />
            <label htmlFor="recipient-csv" className={cn(
              "flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-accent/35 p-4 transition-colors hover:border-primary hover:bg-accent/65 peer-focus-visible:ring-2 peer-focus-visible:ring-ring sm:p-5",
              busy && "pointer-events-none opacity-60",
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
  const banks = useQuery({
    queryKey: ["nigerian-bank-directory"], enabled: open, staleTime: 15 * 60_000, retry: false,
    queryFn: async (): Promise<BankOption[]> => {
      const result = await SupabaseApiService.getBanks();
      if (!Array.isArray(result?.data) || !result.data.length) throw new Error("Bank directory is unavailable.");
      return result.data;
    },
  });
  const term = search.trim().toLowerCase();
  const matches = banks.data?.filter(({ name, code }) => name.toLowerCase().includes(term) || String(code).includes(term));
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="group rounded-xl border px-3 text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
        CSV format and bank codes <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {open && <div className="space-y-2 pb-3">
        <code className="block rounded-lg bg-muted/70 p-2 text-xs [overflow-wrap:anywhere]">bank_code,account_number,amount,narration</code>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">Set the bank code and account number columns to text in your spreadsheet to preserve leading zeros. Amounts are in naira, and narration is optional.</p>
        <Input aria-label="Search bank codes" placeholder="Search bank name or code" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-lg" />
        {banks.isPending && <p role="status" className="text-xs text-muted-foreground">Loading banks…</p>}
        {banks.isError && <Button type="button" variant="outline" size="sm" onClick={() => void banks.refetch()}>Reload banks</Button>}
        {matches?.length === 0 && <p className="text-xs text-muted-foreground">No matching banks.</p>}
        <ul className="max-h-40 divide-y overflow-y-auto pr-2" aria-label="Bank codes">
          {matches?.map(({ name, code }) => <li key={`${code}-${name}`} className="flex items-baseline justify-between gap-3 py-2"><span>{name}</span><span className="font-mono text-muted-foreground">{code}</span></li>)}
        </ul>
      </div>}
    </details>
  );
}
