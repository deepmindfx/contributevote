import { useState } from "react";
import type { FormEvent } from "react";
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
}

export function BvnInputDialog({ open, onOpenChange, onSubmit, isLoading = false, initialBvn, accountFor = "group" }: BvnInputDialogProps) {
  const [bvn, setBvn] = useState("");
  const savedBvn = initialBvn && /^\d{11}$/.test(initialBvn) ? initialBvn : "";
  const value = savedBvn || bvn;

  const changeOpen = (next: boolean) => {
    if (isLoading) return;
    if (!next) setBvn("");
    onOpenChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || !/^\d{11}$/.test(value)) return;
    onSubmit(value);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up a bank account</DialogTitle>
          <DialogDescription>
            {accountFor === "group" ? "Members can transfer directly to this group." : "Transfer from your bank to fund your wallet."} Flutterwave uses your BVN to verify the account.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {savedBvn ? (
            <p className="rounded-xl bg-accent px-3 py-2.5 text-sm text-accent-foreground">
              Using your saved BVN ending in {savedBvn.slice(-4)}.
            </p>
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
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isLoading || value.length !== 11}>
              {isLoading ? "Creating account…" : "Create bank account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
