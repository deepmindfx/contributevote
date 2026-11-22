import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { WalletService } from "@/services/supabase/walletService";
import type { ReservedAccountData } from "@/services/supabase/walletService";
import { BvnInputDialog } from "@/components/contribution/BvnInputDialog";
import { WalletAccountDetails } from "./WalletAccountDetails";

export default function ReservedAccount() {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [account, setAccount] = useState<ReservedAccountData | null>();
  const [working, setWorking] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const userId = user?.id;
  const primary = account?.accountNumber ? account : account?.accounts?.[0] ? { ...account, ...account.accounts[0] } : null;
  const additional = account?.accounts?.filter((item) => item.accountNumber !== primary?.accountNumber || item.bankName !== primary?.bankName);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const existing = await WalletService.getVirtualAccount(userId);
      if (active) setAccount(existing);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  const create = async (bvn: string) => {
    if (!userId || working) return;
    setWorking(true);
    try {
      const created = await WalletService.createVirtualAccount(userId, "bvn", bvn);
      if (created) {
        setAccount(created);
        setShowVerification(false);
        await refreshCurrentUser();
      }
    } finally {
      setWorking(false);
    }
  };

  const refresh = async () => {
    if (!userId || working) return;
    setWorking(true);
    try {
      const [updated] = await Promise.all([WalletService.getVirtualAccount(userId), refreshCurrentUser(), refreshContributionData(true)]);
      if (updated) setAccount(updated);
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
        {account === undefined ? (
          <Skeleton className="h-32 w-full rounded-2xl" role="status" aria-label="Loading bank account" />
        ) : primary ? (
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
          </>
        ) : (
          <>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><Building2 size={20} aria-hidden="true" /></div>
            <h2 className="text-lg font-semibold">{account ? "Account number pending" : "Set up bank transfers"}</h2>
            <p className="text-sm text-muted-foreground">{account ? "Refresh to check whether your account number is ready." : "Create a dedicated bank account to receive transfers into your wallet."}</p>
            <Button className="h-11 w-full" onClick={account ? refresh : () => setShowVerification(true)} disabled={working}>{account ? "Refresh account" : "Set up bank account"}</Button>
          </>
        )}
      </Card>
      <BvnInputDialog open={showVerification} onOpenChange={setShowVerification} onSubmit={create} isLoading={working} initialBvn={user?.bvn} accountFor="wallet" />
    </>
  );
}
