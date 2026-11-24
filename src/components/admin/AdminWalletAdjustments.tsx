import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminComplianceService } from "@/services/supabase/adminComplianceService";
import { AdminPageControls, useAdminRecordPage } from "./AdminRecordPage";

type Adjustment = {
  id: string;
  target_user_id: string;
  target_name: string;
  submitted_by: string;
  case_reference: string;
  direction: "credit" | "debit";
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });

export function AdminWalletAdjustments({ adminId, onSettled }: {
  adminId: string;
  onSettled: () => Promise<void>;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [review, setReview] = useState<{ request: Adjustment; approve: boolean }>();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const requests = useAdminRecordPage<Adjustment>(adminId, showHistory ? "wallet_history" : "wallet_pending");
  const openReview = (request: Adjustment, approve: boolean) => {
    setPin("");
    setReview({ request, approve });
  };
  const decide = async () => {
    if (!review || pin.length !== 4 || busy) return;
    setBusy(true);
    try {
      const result = await AdminComplianceService.decideWalletAdjustment(review.request.id, review.approve, pin);
      if (!result.success) throw new Error(result.error || "Could not record the decision.");
      toast.success(result.status === "approved" ? "Wallet adjustment approved" : "Wallet adjustment rejected");
      setReview(undefined);
      void onSettled();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the decision.");
    } finally {
      setPin("");
      setBusy(false);
    }
  };

  return (
    <section className="cp-card-native space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Wallet adjustments</h2>
          <p className="text-sm text-muted-foreground">Wallet debits require two administrators to confirm with their own transaction PINs.</p>
          <Link className="text-sm text-primary underline" to="/settings">Manage your transaction PIN</Link>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Pending requests" : "Recent decisions"}
        </Button>
      </div>
      {requests.loaded && requests.rows.length === 0 && <p className="text-sm text-muted-foreground">{showHistory ? "No decisions on this page." : "No requests on this page."}</p>}
      <div className="divide-y divide-border">
        {requests.rows.map((request) => (
          <div key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium capitalize">{request.direction} {naira.format(request.amount)}</p>
                <Badge variant="outline" className="capitalize">{request.status}</Badge>
              </div>
              <p className="break-words text-sm">{request.target_name} · {request.case_reference}</p>
              <p className="break-words text-sm text-muted-foreground">{request.reason}</p>
            </div>
            {request.status === "pending" && (
              request.submitted_by === adminId || request.target_user_id === adminId
                ? <span className="text-sm text-muted-foreground">Awaiting an independent reviewer</span>
                : <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openReview(request, false)}>Reject</Button>
                    {request.direction === "debit" && <Button size="sm" onClick={() => openReview(request, true)}>Review and approve</Button>}
                  </div>
            )}
          </div>
        ))}
      </div>
      <AdminPageControls listing={requests} label="wallet adjustments" />
      <Dialog open={Boolean(review)} onOpenChange={(open) => { if (!open && !busy) { setReview(undefined); setPin(""); } }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{review?.approve ? "Approve wallet adjustment" : "Reject wallet adjustment"}</DialogTitle>
            {review && <DialogDescription>
              {review.request.direction === "credit" ? "Credit" : "Debit"} {naira.format(review.request.amount)} · {review.request.target_name} · {review.request.case_reference}
            </DialogDescription>}
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void decide(); }}>
            <div className="space-y-2">
              <Label htmlFor="wallet-review-pin">Your transaction PIN</Label>
              <Input id="wallet-review-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4}
                value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} disabled={busy} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || pin.length !== 4} variant={review?.approve ? "default" : "destructive"}>
                {busy ? "Recording…" : review?.approve ? "Approve adjustment" : "Reject request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
