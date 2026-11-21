import { Building2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ReservedAccountData } from "@/services/supabase/walletService";

export function WalletAccountDetails({ account }: { account: ReservedAccountData }) {
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Couldn’t copy. You can select the text instead.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-accent/45 p-3 sm:p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Building2 size={17} aria-hidden="true" /> {account.bankName || "Bank account"}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Account number</p>
            <p className="select-all break-all font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{account.accountNumber}</p>
          </div>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 bg-card" aria-label="Copy account number"
            onClick={() => void copy(account.accountNumber || "", "Account number copied.")}>
            <Copy size={16} aria-hidden="true" />
          </Button>
        </div>
        {account.accountName && <p className="mt-2 break-words text-sm text-muted-foreground">{account.accountName}</p>}
      </div>
      <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={() => void copy(
        [account.bankName, account.accountName, account.accountNumber].filter(Boolean).join("\n"), "Bank details copied.",
      )}>
        <Copy size={16} aria-hidden="true" /> Copy bank details
      </Button>
    </div>
  );
}
