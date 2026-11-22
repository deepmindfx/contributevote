import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import WalletActions from "@/components/dashboard/wallet/WalletActions";
import { CurrencySelector } from "@/components/wallet/CurrencySelector";

export default function WalletCard({ onOpenBankAccount, isDepositOpen, setIsDepositOpen }: {
  onOpenBankAccount: () => void;
  isDepositOpen: boolean;
  setIsDepositOpen: (open: boolean) => void;
}) {
  const { user } = useSupabaseUser();
  const [showBalance, setShowBalance] = useState(true);
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const naira = Number(user?.wallet_balance || 0);
  const balance = currencyType === "NGN"
    ? `₦${naira.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${(naira / 1550).toFixed(2)}`;

  return (
    <Card className="dashboard-wallet-card overflow-hidden rounded-[1.35rem]">
      <div className="wallet-overview px-5 pb-7 pt-4 sm:px-7 sm:pb-9 sm:pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 items-center gap-0.5">
            <p className="text-sm font-medium text-white/90">Available balance</p>
            <Button variant="ghost" size="icon" onClick={() => setShowBalance(!showBalance)} aria-label={showBalance ? "Hide balance" : "Show balance"}
              className="h-11 w-11 shrink-0 rounded-full text-white/80 hover:bg-white/15 hover:text-white">
              {showBalance ? <EyeOff size={17} /> : <Eye size={17} />}
            </Button>
          </div>
          <CurrencySelector value={currencyType} onChange={setCurrencyType} onDark />
        </div>
        <p className="break-words text-[clamp(1.875rem,7.6vw,3.3rem)] font-semibold leading-tight tracking-[-.06em] tabular-nums">
          {showBalance ? balance : `${currencyType === "NGN" ? "₦" : "$"}•••••••`}
        </p>
      </div>
      <CardContent className="dashboard-wallet-content p-0">
        <WalletActions isDepositOpen={isDepositOpen} setIsDepositOpen={setIsDepositOpen} onOpenBankAccount={onOpenBankAccount} showQuickActions />
      </CardContent>
    </Card>
  );
}
