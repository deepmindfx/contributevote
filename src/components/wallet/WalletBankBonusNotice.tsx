import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WalletBankBonusOffer } from "@/services/supabase/walletBankBonusService";

export function formatWalletBonus(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount);
}

export function WalletBankBonusNotice({ offer, onSetup }: {
  offer: WalletBankBonusOffer;
  onSetup?: () => void;
}) {
  return (
    <aside className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
      <Gift className="shrink-0 text-primary" size={18} aria-hidden="true" />
      <div className="min-w-[9rem] flex-1">
        <p className="text-sm font-semibold">Get {formatWalletBonus(offer.amount)} with bank setup</p>
        <p className="text-xs text-muted-foreground">
          Verify your BVN and set up a personal bank account to get withdrawable wallet credit. Available while the offer lasts.
        </p>
      </div>
      {onSetup && <Button type="button" size="sm" variant="outline" className="ml-auto min-h-11" onClick={onSetup}>Set up bank account</Button>}
    </aside>
  );
}
