import React, { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { hasTransactionPin } from "@/lib/transactionPin";

interface TransactionPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  amount?: number;
  confirmLabel?: string;
  pending?: boolean;
  /** The action verifies the PIN and returns its result in one server request. */
  verifyInAction?: boolean;
  onVerified: (pin: string) => Promise<void> | void;
}

export function TransactionPinDialog({
  open,
  onOpenChange,
  title = "Authorize with Transaction PIN",
  description = "Enter your 4-digit Transaction PIN to confirm this action.",
  amount,
  confirmLabel = "Confirm & Proceed",
  pending = false,
  verifyInAction = false,
  onVerified,
}: TransactionPinDialogProps) {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const hasSavedPin = hasTransactionPin(user?.preferences);

  const [pin, setPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirmNewPin("");
      setError("");
      setShowPin(false);
    }
  }, [open]);

  const busy = pending || submitting;

  const handleCreateAndAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit numeric PIN.");
      return;
    }
    if (pin !== confirmNewPin) {
      setError("PINs do not match. Re-enter both fields.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("set_user_transaction_pin", {
        p_new_pin: pin,
        p_current_pin: null,
      });

      if (rpcErr || !data?.success) {
        setError(data?.error || rpcErr?.message || "Could not save your PIN.");
        return;
      }

      await refreshCurrentUser();
      toast.success("4-digit Transaction PIN created!");
      await onVerified(pin);
    } catch (err: any) {
      setError(err?.message || "Failed to save PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit Transaction PIN.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (!verifyInAction) {
        const { data, error: rpcErr } = await (supabase as any).rpc("verify_user_transaction_pin", { p_pin: pin });
        if (rpcErr || !data?.success) {
          setError(data?.error || rpcErr?.message || "Incorrect 4-digit Transaction PIN.");
          setPin("");
          return;
        }
      }
      await onVerified(pin);
    } catch (err: any) {
      setError(err?.message || "Could not verify PIN.");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm rounded-2xl p-6">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
            {hasSavedPin ? <Lock className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight">
            {hasSavedPin ? title : "Create your 4-digit PIN"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {hasSavedPin
              ? description
              : "Set a 4-digit Transaction PIN once to protect transfers, group contributions, and withdrawals."}
          </DialogDescription>
        </DialogHeader>

        {typeof amount === "number" && amount > 0 && (
          <div className="rounded-2xl border bg-accent/45 px-4 py-3 text-center">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Authorizing amount
            </span>
            <span className="text-xl font-extrabold tracking-tight text-foreground tabular-nums">
              ₦{amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {hasSavedPin ? (
          <form onSubmit={handleVerifyAndProceed} className="space-y-4 pt-1">
            <div className="flex flex-col items-center space-y-3">
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={(val) => {
                  setPin(val.replace(/\D/g, "").slice(0, 4));
                  setError("");
                }}
                inputMode="numeric"
                disabled={busy}
                autoFocus
              >
                <InputOTPGroup className="gap-2.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <InputOTPSlot
                      key={idx}
                      index={idx}
                      className={cn(
                        "h-12 w-12 rounded-xl border text-xl font-bold sm:h-14 sm:w-14",
                        !showPin &&
                          pin[idx] &&
                          "text-transparent after:absolute after:h-3 after:w-3 after:rounded-full after:bg-foreground"
                      )}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPin ? "Hide PIN" : "Show PIN"}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-center text-xs font-semibold text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="h-11 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || pin.length !== 4}
                className="h-11 rounded-xl font-bold"
              >
                {busy ? "Verifying…" : confirmLabel}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateAndAuthorize} className="space-y-4 pt-1">
            <div className="flex flex-col items-center space-y-3">
              <div className="space-y-1.5 text-center">
                <span className="text-xs font-semibold text-foreground">Choose 4-digit PIN</span>
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={(val) => {
                    setPin(val.replace(/\D/g, "").slice(0, 4));
                    setError("");
                  }}
                  inputMode="numeric"
                  disabled={busy}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
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

              <div className="space-y-1.5 text-center">
                <span className="text-xs font-semibold text-foreground">Confirm PIN</span>
                <InputOTP
                  maxLength={4}
                  value={confirmNewPin}
                  onChange={(val) => {
                    setConfirmNewPin(val.replace(/\D/g, "").slice(0, 4));
                    setError("");
                  }}
                  inputMode="numeric"
                  disabled={busy}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <InputOTPSlot
                        key={idx}
                        index={idx}
                        className={cn(
                          "h-12 w-12 rounded-xl border text-lg font-bold",
                          !showPin &&
                            confirmNewPin[idx] &&
                            "text-transparent after:absolute after:h-2.5 after:w-2.5 after:rounded-full after:bg-foreground"
                        )}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPin ? "Hide digits" : "Show digits"}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-center text-xs font-semibold text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy || pin.length !== 4 || confirmNewPin.length !== 4}
              className="h-11 w-full gap-1.5 rounded-xl font-bold"
            >
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Saving PIN…" : "Save PIN & Continue"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
