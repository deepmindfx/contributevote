import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { naira } from "@/services/supabase/pricingService";

type Decision = "request" | "approve" | "cancel";
type Review = {
  id: string;
  reference_id: string;
  amount: number;
  transfer_status: string;
  bulk: boolean;
  status: "pending" | "approved" | "cancelled";
  basis: "not_debited" | "reversed";
  evidence_reference: string;
  evidence_note: string;
  submitted_by: string;
};
type Inbound = { provider_id: string; amount: number; reason: "destination_unresolved" | "settlement_failed" };

export function AdminPaymentReviews() {
  const { user, isAdmin } = useSupabaseUser();
  const [reference, setReference] = useState("");
  const [basis, setBasis] = useState("not_debited");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState<{ type: Decision; reviewId?: string }>();
  const [saving, setSaving] = useState(false);

  const payouts = useQuery({
    queryKey: ["workspace", user?.id, "admin-payout-recoveries"],
    enabled: Boolean(user?.id && isAdmin),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_list_payout_recoveries").abortSignal(signal);
      if (error) throw error;
      return data as unknown as Review[];
    },
  });
  const inbound = useQuery({
    queryKey: ["workspace", user?.id, "admin-inbound-review"],
    enabled: Boolean(user?.id && isAdmin),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("admin_list_pending_inbound_payments").abortSignal(signal);
      if (error) throw error;
      return data as unknown as Inbound[];
    },
  });

  const request = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAction({ type: "request" });
  };
  const save = async (pin: string) => {
    if (!action || saving) return;
    setSaving(true);
    try {
      if (action.type === "request") {
        const { data, error } = await supabase.rpc("admin_request_payout_recovery", {
          p_reference: reference.trim(), p_basis: basis, p_evidence_reference: evidence.trim(),
          p_evidence_note: note.trim(), p_pin: pin,
        });
        if (error) throw new Error(error.message);
        const created = data as { id?: string; error?: string } | null;
        if (!created?.id) throw new Error(created?.error || "The payout evidence could not be saved.");
        setReference("");
        setEvidence("");
        setNote("");
        toast.success("Recovery submitted for a second administrator to review.");
      } else if (action.reviewId) {
        const { data, error } = await supabase.functions.invoke("admin-payout-recovery", {
          body: { review_id: action.reviewId, approve: action.type === "approve", pin },
        });
        if (error) {
          const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
          throw new Error(details?.error || "The payout review could not be updated.");
        }
        toast.success(data?.status === "approved" ? "Wallet credit recorded." : "Review closed.");
      }
      setAction(undefined);
      await payouts.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="cp-card-native space-y-4" aria-labelledby="payout-review-title">
        <h3 id="payout-review-title" className="font-semibold">Payout recovery</h3>
        <p className="text-sm text-muted-foreground">Use the original payout reference and independent provider settlement evidence that the funds were never debited or have been returned. A second administrator verifies the evidence before a wallet credit.</p>
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">Submit settlement evidence</summary>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={request}>
            <div className="space-y-1">
              <Label htmlFor="payout-recovery-reference">CollectiPay payout reference</Label>
              <Input id="payout-recovery-reference" value={reference} maxLength={80} onChange={event => setReference(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payout-recovery-basis">Provider outcome</Label>
              <select id="payout-recovery-basis" className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={basis} onChange={event => setBasis(event.target.value)}>
                <option value="not_debited">No debit confirmed</option>
                <option value="reversed">Reversal confirmed</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="payout-recovery-evidence">Provider settlement case reference</Label>
              <Input id="payout-recovery-evidence" value={evidence} minLength={5} maxLength={150} onChange={event => setEvidence(event.target.value)} required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="payout-recovery-note">Evidence summary</Label>
              <textarea id="payout-recovery-note" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                value={note} minLength={20} maxLength={1000} onChange={event => setNote(event.target.value)} required />
            </div>
            <Button className="w-fit" type="submit">Request review</Button>
          </form>
        </details>

        {payouts.isPending && <p role="status" className="text-sm">Loading payout reviews…</p>}
        {payouts.isError && <Button variant="outline" size="sm" onClick={() => void payouts.refetch()}>Retry payout reviews</Button>}
        {payouts.data?.map(review => (
          <article key={review.id} className="space-y-2 rounded-xl border p-3 text-sm">
            <p className="font-medium">{naira.format(review.amount)} · {review.bulk ? "Bulk recipient" : "Single payout"} · {review.status === "pending" ? "Awaiting review" : review.status}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{review.reference_id}</p>
            <p>{review.basis === "reversed" ? "Reversal" : "No debit"} · {review.evidence_reference}</p>
            <p className="break-words text-muted-foreground">{review.evidence_note}</p>
            {review.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                {review.submitted_by !== user?.id && review.transfer_status === "pending" &&
                  <Button size="sm" onClick={() => setAction({ type: "approve", reviewId: review.id })}>Approve verified return</Button>}
                <Button size="sm" variant="outline" onClick={() => setAction({ type: "cancel", reviewId: review.id })}>Close review</Button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="cp-card-native space-y-2" aria-labelledby="incoming-review-title">
        <h3 id="incoming-review-title" className="font-semibold">Unmatched incoming payments</h3>
        <p className="text-sm text-muted-foreground">Verified Flutterwave payments waiting for an account match or ledger settlement. The reconciliation worker retries them automatically.</p>
        {inbound.isError && <Button variant="outline" size="sm" onClick={() => void inbound.refetch()}>Retry incoming payments</Button>}
        {inbound.data?.map(item => (
          <p className="break-all text-sm" key={item.provider_id}>
            {naira.format(item.amount)} · Flutterwave {item.provider_id} · {item.reason === "destination_unresolved" ? "Account match pending" : "Settlement pending"}
          </p>
        ))}
        {inbound.data?.length === 0 && <p className="text-sm text-muted-foreground">No incoming payments currently need review.</p>}
      </section>
      <TransactionPinDialog open={Boolean(action)} onOpenChange={open => { if (!open && !saving) setAction(undefined); }}
        title={action?.type === "approve" ? "Approve payout recovery" : action?.type === "cancel" ? "Close payout review" : "Submit payout evidence"}
        description={action?.type === "approve" ? "Confirm you independently verified the provider settlement evidence for this payout." : undefined}
        confirmLabel={action?.type === "approve" ? "Return debit to wallet" : "Confirm"}
        pending={saving} verifyInAction onVerified={save} />
    </div>
  );
}
