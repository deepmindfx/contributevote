import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BvnInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bvn: string) => void;
  isLoading?: boolean;
  initialBvn?: string | null;
  accountFor?: "group" | "wallet";
  onBonusVerification?: (bvn: string) => void;
  feedback?: ReactNode;
}

export function BvnInputDialog({ open, onOpenChange, onSubmit, isLoading = false, initialBvn, accountFor = "group", onBonusVerification, feedback }: BvnInputDialogProps) {
  const [bvn, setBvn] = useState("");
  const [editingSavedBvn, setEditingSavedBvn] = useState(false);
  const savedBvn = initialBvn && /^\d{11}$/.test(initialBvn) ? initialBvn : "";
  const useSavedBvn = Boolean(savedBvn) && !editingSavedBvn;
  const value = useSavedBvn ? savedBvn : bvn;

  const changeOpen = (next: boolean) => {
    if (isLoading) return;
    if (!next) {
      setBvn("");
      setEditingSavedBvn(false);
    }
    onOpenChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || !/^\d{11}$/.test(value)) return;
    (onBonusVerification ?? onSubmit)(value);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up a bank account</DialogTitle>
          <DialogDescription>
            {accountFor === "group" ? "Members can transfer directly to this group." : "Transfer from your bank to fund your wallet."} Flutterwave uses your BVN to verify the account.
            {onBonusVerification && " To claim the bonus, share your BVN and CollectiPay email on Flutterwave’s consent page."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {useSavedBvn ? (
            <div className="flex flex-wrap items-center gap-x-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
              <p className="flex-1">Using your saved BVN ending in {savedBvn.slice(-4)}.</p>
              {accountFor === "wallet" && (
                <Button type="button" size="sm" variant="ghost" disabled={isLoading} onClick={() => setEditingSavedBvn(true)}>Use another BVN</Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="group-bank-bvn">Bank Verification Number (BVN)</Label>
              <Input
                id="group-bank-bvn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="11 digits"
                value={bvn}
                onChange={(event) => setBvn(event.target.value.replace(/\D/g, "").slice(0, 11))}
                maxLength={11}
                aria-describedby="group-bank-bvn-help"
                disabled={isLoading}
              />
              <p id="group-bank-bvn-help" className="text-sm text-muted-foreground">We save your BVN to your profile so you can reuse it.</p>
            </div>
          )}
          {feedback}
          <DialogFooter className="gap-2">
            {onBonusVerification && (
              <Button type="button" variant="outline" disabled={isLoading || value.length !== 11} onClick={() => onSubmit(value)}>Bank setup only</Button>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || value.length !== 11}>
              {isLoading ? "Checking…" : onBonusVerification ? "Verify BVN and claim" : "Create bank account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
