import { useEffect, useState } from "react";
import { Check, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GroupContributionService } from "@/services/supabase/groupContributionService";
import { naira } from "@/services/supabase/pricingService";

type Transfer = Awaited<ReturnType<typeof GroupContributionService.getPendingBankTransfers>>[number];
const dateFormat = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export function PendingBankTransfers({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const [payments, setPayments] = useState<Transfer[]>();
  const [accounts, setAccounts] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setPayments(undefined);
    setError("");
    void GroupContributionService.getPendingBankTransfers(groupId).then(
      (result) => { if (active) setPayments(result); },
      () => { if (active) setError("Couldn’t load outside bank transfers."); },
    );
    return () => { active = false; };
  }, [groupId, isAdmin, version]);

  const assign = async (paymentId: string) => {
    if (assigning || !accounts[paymentId]?.trim()) return;
    setAssigning(paymentId);
    try {
      await GroupContributionService.verifyBankTransfer(paymentId, accounts[paymentId]);
      setPayments((previous) => previous?.filter(({ id }) => id !== paymentId));
      toast.success("Transfer linked. The contributor now has voting rights.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t link this transfer.");
    } finally {
      setAssigning(undefined);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card className="space-y-4 rounded-2xl p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">Outside bank transfers</h3>
        <p className="mt-1 text-sm text-muted-foreground">Match a confirmed transfer to the sender’s registered account. The payment is already in the group balance.</p>
      </div>
      {error ? (
        <div className="flex flex-wrap items-center gap-2 text-sm"><p role="status">{error}</p><Button variant="outline" onClick={() => setVersion((count) => count + 1)}>Retry</Button></div>
      ) : !payments ? (
        <p role="status" className="text-sm text-muted-foreground">Loading transfers…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outside transfers to assign.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {payments.map((payment) => (
            <li key={payment.id} className="space-y-3 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Landmark size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{payment.sender_name || "Unidentified sender"}</p>
                    <p className="text-xs text-muted-foreground">{[payment.sender_bank, dateFormat.format(new Date(payment.created_at))].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <span className="font-semibold tabular-nums">{naira.format(payment.amount)}</span>
              </div>
              <p className="break-all text-xs text-muted-foreground">Reference {payment.reference_id}</p>
              {payment.verification_status === "flagged" && <p className="text-xs font-medium text-destructive">Flagged for platform review.</p>}
              <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void assign(payment.id); }}>
                <div className="min-w-44 flex-1 space-y-1">
                  <Label htmlFor={`transfer-member-${payment.id}`}>Registered email or user ID</Label>
                  <Input id={`transfer-member-${payment.id}`} value={accounts[payment.id] || ""} onChange={(event) => setAccounts((previous) => ({ ...previous, [payment.id]: event.target.value }))} />
                </div>
                <Button type="submit" className="h-11 gap-2" disabled={!!assigning || !accounts[payment.id]?.trim()}>
                  <Check size={16} aria-hidden="true" /> {assigning === payment.id ? "Assigning…" : "Verify and grant rights"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
