import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { BankPicker } from "@/components/wallet/BankPicker";
import { bulkMoney } from "@/components/wallet/BulkTransferDetails";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBankDirectory } from "@/hooks/useBankDirectory";
import { parseBulkAmount, type BulkRecipientInput } from "@/lib/bulkTransfers";
import type { BankOption } from "@/services/supabase/beneficiaryService";
import type { BulkTransferSettings } from "@/services/supabase/bulkTransferService";

type Editor = { id?: string; bank: BankOption | null; account: string; amount: string };
type Recipient = { id: string; bank: BankOption; account: string; amount: number };
const emptyEditor: Editor = { bank: null, account: "", amount: "" };

export function BulkTransferRecipientsForm({ settings, active, busy, error, onEdit, onReview }: {
  settings: BulkTransferSettings;
  active: boolean;
  busy: boolean;
  error: string;
  onEdit: () => void;
  onReview: (title: string, recipients: BulkRecipientInput[]) => Promise<void>;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [editor, setEditor] = useState<Editor | null>(emptyEditor);
  const [title, setTitle] = useState("");
  const [editorError, setEditorError] = useState("");
  const banks = useBankDirectory(active);
  const total = recipients.reduce((cents, recipient) => cents + Math.round(recipient.amount * 100), 0) / 100;
  const limitError = recipients.length > settings.max_recipients
    ? `This batch can contain up to ${settings.max_recipients} recipients.`
    : total > settings.max_batch_amount ? `The batch limit is ${bulkMoney(settings.max_batch_amount)}.` : "";
  const canReview = !editor && recipients.length >= 2 && !limitError && !busy;

  const edit = (next: Editor | null) => {
    setEditor(next);
    setEditorError("");
    onEdit();
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!editor || busy) return;
    if (!editor.id && recipients.length >= settings.max_recipients) {
      setEditorError(`This batch can contain up to ${settings.max_recipients} recipients.`);
      return;
    }
    const { bank, account } = editor;
    const amount = parseBulkAmount(editor.amount.trim());
    if (!bank || !/^\d{10}$/.test(account) || amount === null) {
      setEditorError(!bank ? "Choose the recipient’s bank." : !/^\d{10}$/.test(account)
        ? "Enter the recipient’s full 10-digit account number."
        : "Enter an amount between ₦100 and ₦500,000 with up to two decimal places.");
      return;
    }
    const row = { id: editor.id ?? crypto.randomUUID(), bank, account, amount };
    setRecipients(editor.id ? recipients.map((item) => item.id === row.id ? row : item) : [...recipients, row]);
    edit(null);
  };

  const review = async () => {
    if (!canReview) return;
    await onReview(title.trim() || "Bulk transfer", recipients.map((recipient) => ({
      account_bank: recipient.bank.code,
      account_number: recipient.account,
      amount: recipient.amount,
      narration: "",
    })));
  };

  return (
    <Card className="min-w-0 overflow-hidden rounded-3xl">
      <div className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add recipients</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a bank by name. Add at least 2 recipients to review the batch.</p>
        </div>
        {!!recipients.length && <ul aria-label="Batch recipients" className="divide-y rounded-xl border px-3">
          {recipients.map((recipient, index) => (
            <li key={recipient.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-24 flex-1">
                <p className="break-words text-sm font-medium">{recipient.bank.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{recipient.account}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{bulkMoney(recipient.amount)}</p>
              <div className="flex">
                <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Edit recipient ${index + 1}`}
                  disabled={busy} onClick={() => edit({ ...recipient, amount: String(recipient.amount) })}><Pencil size={15} aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`Remove recipient ${index + 1}`}
                  disabled={busy} onClick={() => { setRecipients(recipients.filter(({ id }) => id !== recipient.id)); if (editor?.id === recipient.id) edit(null); else onEdit(); }}>
                  <X size={17} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>}
        {editor ? (
          <form onSubmit={add} noValidate className="space-y-3 rounded-2xl border bg-muted/20 p-3.5">
            <BankPicker bank={editor.bank} banks={banks.data} isError={banks.isError} isFetching={banks.isFetching}
              onRetry={() => void banks.refetch()} onSelect={(bank) => edit({ ...editor, bank })} disabled={busy} />
            <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="bulk-account-number">Account number</Label>
                <Input id="bulk-account-number" inputMode="numeric" placeholder="10 digits" autoComplete="off" value={editor.account}
                  onChange={(event) => edit({ ...editor, account: event.target.value.replace(/\s+/g, "") })} className="h-11 rounded-xl" disabled={busy} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="bulk-recipient-amount">Amount (₦)</Label>
                <Input id="bulk-recipient-amount" inputMode="decimal" placeholder="0.00" value={editor.amount}
                  onChange={(event) => edit({ ...editor, amount: event.target.value })} className="h-11 rounded-xl" disabled={busy} />
              </div>
            </div>
            {editorError && <p role="alert" className="text-sm text-destructive">{editorError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {recipients.length > 0 && <Button type="button" variant="ghost" disabled={busy} onClick={() => edit(null)}>Cancel</Button>}
              <Button type="submit" variant="secondary" className="gap-1.5 rounded-xl" disabled={busy}>
                {editor.id ? "Save recipient" : <><Plus size={16} aria-hidden="true" /> Add recipient</>}
              </Button>
            </div>
          </form>
        ) : recipients.length < settings.max_recipients && (
          <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-xl" disabled={busy} onClick={() => edit(emptyEditor)}>
            <Plus size={17} aria-hidden="true" /> Add another recipient
          </Button>
        )}
        {recipients.length >= 2 && <div className="space-y-1.5">
          <Label htmlFor="bulk-manual-title">Batch name <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="bulk-manual-title" placeholder="e.g. November salaries" maxLength={80} value={title} disabled={busy}
            className="h-11 rounded-xl" onChange={(event) => { setTitle(event.target.value); onEdit(); }} />
        </div>}
        {(limitError || error) && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">{limitError || error}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/25 px-4 py-3 sm:px-6">
        <p className="min-w-0 text-xs tabular-nums text-muted-foreground">
          {recipients.length} of {settings.max_recipients} recipients{recipients.length > 0 && ` · ${bulkMoney(total)} before fees`}
        </p>
        <Button type="button" size="lg" disabled={!canReview} className="h-11 w-full gap-2 rounded-xl sm:w-auto" onClick={() => void review()}>
          {busy ? <><LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" /> Verifying recipients…</>
            : <>Review batch <ArrowRight size={16} aria-hidden="true" /></>}
        </Button>
      </div>
    </Card>
  );
}
