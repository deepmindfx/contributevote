import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { WalletService } from "@/services/supabase/walletService";
import type { ReservedAccountData } from "@/services/supabase/walletService";
import { BvnInputDialog } from "@/components/contribution/BvnInputDialog";
import { WalletAccountDetails } from "./WalletAccountDetails";
import { WalletReportLinks } from "./WalletReportLinks";
import { formatWalletBonus, WalletBankBonusNotice } from "./WalletBankBonusNotice";
import { useWalletBankBonus, walletBankBonusOfferKey } from "@/hooks/useWalletBankBonus";

export default function ReservedAccount() {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const verificationId = search.get("wallet-verification");
  const [working, setWorking] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ userId: string; account: ReservedAccountData }>();
  const userId = user?.id;
  const account = createdAccount && createdAccount.userId === userId
    ? createdAccount.account
    : (user?.preferences as { virtualAccount?: ReservedAccountData } | null)?.virtualAccount;
  const primary = account?.accountNumber ? account : account?.accounts?.[0] ? { ...account, ...account.accounts[0] } : null;
  const offer = useWalletBankBonus(account ? undefined : userId);
  const additional = account?.accounts?.filter((item) => item.accountNumber !== primary?.accountNumber || item.bankName !== primary?.bankName);

  const create = async (details: { bvn: string; claimBonus: boolean } | { verificationId: string }) => {
    if (!userId || working) return;
    setWorking(true);
    try {
      const created = await WalletService.createVirtualAccount(details);
      if ("verificationUrl" in created) {
        window.location.assign(created.verificationUrl);
        return;
      }
      setCreatedAccount({ userId, account: created.account });
      setShowVerification(false);
      if (verificationId) {
        const next = new URLSearchParams(search);
        next.delete("wallet-verification");
        setSearch(next, { replace: true });
      }
      toast.success(created.bonusAmount > 0
        ? `${formatWalletBonus(created.bonusAmount)} added to your wallet`
        : "Bank account created.");
      void queryClient.invalidateQueries({ queryKey: walletBankBonusOfferKey });
      await Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t set up your bank account.");
    } finally {
      setWorking(false);
    }
  };

  const refresh = async () => {
    if (!userId || working) return;
    setWorking(true);
    try {
      await Promise.all([refreshCurrentUser(), refreshContributionData(true)]);
      toast.success("Bank account refreshed.");
    } catch {
      toast.error("Couldn’t refresh your bank account.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <Card className="space-y-4 rounded-2xl p-4 sm:p-6">
        {primary ? (
          <>
            <WalletAccountDetails account={primary} />
            {additional && additional.length > 0 && (
              <details className="rounded-xl border px-3">
                <summary className="app-disclosure font-medium">Other bank accounts <ChevronDown size={16} aria-hidden="true" /></summary>
                <div className="space-y-3 pb-3">
                  {additional.map((item) => <WalletAccountDetails key={item.bankCode + item.accountNumber} account={{ ...item, accountName: account?.accountName }} />)}
                </div>
              </details>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Button asChild variant="ghost"><Link to="/wallet-history?view=bank">Bank history</Link></Button>
              <Button variant="ghost" className="gap-2" onClick={refresh} disabled={working}><RefreshCw size={16} className={working ? "motion-safe:animate-spin" : ""} aria-hidden="true" /> Refresh</Button>
            </div>
            <WalletReportLinks scope="wallet" />
          </>
        ) : (
          <>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><Building2 size={20} aria-hidden="true" /></div>
            <h2 className="text-lg font-semibold">{account ? "Account number pending" : "Set up bank transfers"}</h2>
            <p className="text-sm text-muted-foreground">{account ? "Refresh to check whether your account number is ready." : "Create a dedicated bank account to receive transfers into your wallet."}</p>
            {offer && <WalletBankBonusNotice offer={offer} />}
            {verificationId && (
              <Button className="h-11 w-full" onClick={() => void create({ verificationId })} disabled={working}>
                {working ? "Checking verification…" : "Finish bank setup"}
              </Button>
            )}
            <Button variant={verificationId ? "outline" : "default"} className="h-11 w-full" onClick={account ? refresh : () => setShowVerification(true)} disabled={working}>
              {account ? "Refresh account" : verificationId ? "Restart verification" : "Set up bank account"}
            </Button>
          </>
        )}
      </Card>
      <BvnInputDialog open={showVerification} onOpenChange={setShowVerification}
        onSubmit={(bvn) => void create({ bvn, claimBonus: false })}
        onBonusVerification={offer ? (bvn) => void create({ bvn, claimBonus: true }) : undefined}
        isLoading={working} initialBvn={user?.bvn} accountFor="wallet" />
    </>
  );
}
