import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Clock, Plus, SendHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { WalletService } from "@/services/supabase/walletService";
import type { ReservedAccountData } from "@/services/supabase/walletService";
import { WalletAccountDetails } from "@/components/wallet/WalletAccountDetails";

interface WalletActionsProps {
  setIsDepositOpen: (value: boolean) => void;
  isDepositOpen: boolean;
  setShowHistory?: (value: boolean) => void;
  onOpenBankAccount?: () => void;
  showQuickActions?: boolean;
}

export default function WalletActions({ setIsDepositOpen, isDepositOpen, setShowHistory, onOpenBankAccount, showQuickActions }: WalletActionsProps) {
  const { user } = useSupabaseUser();
  const userId = user?.id;
  const [account, setAccount] = useState<ReservedAccountData | null>();
  const bank = account?.accountNumber ? account : account?.accounts?.[0] ? { ...account, ...account.accounts[0] } : null;

  useEffect(() => {
    if (!isDepositOpen || !userId) return;
    let active = true;
    setAccount(undefined);
    void WalletService.getVirtualAccount(userId).then((result) => { if (active) setAccount(result); });
    return () => { active = false; };
  }, [isDepositOpen, userId]);

  return (
    <div className={showQuickActions ? "dashboard-quick-actions" : "bg-card"}>
      {showQuickActions && <h3 className="dashboard-quick-title">Quick actions</h3>}
      <div className="wallet-actions-grid grid grid-cols-2 gap-2 p-3 sm:p-4">
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogTrigger asChild>
            <button type="button" className="wallet-action wallet-primary-action"><Plus size={19} aria-hidden="true" /><span>Add money</span></button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add money</DialogTitle>
              <DialogDescription>Transfer from your bank app to fund your CollectiPay wallet.</DialogDescription>
            </DialogHeader>
            {account === undefined && userId ? (
              <Skeleton className="h-28 w-full rounded-2xl" role="status" aria-label="Loading bank details" />
            ) : bank ? (
              <WalletAccountDetails account={bank} />
            ) : (
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">{account ? "Your account number isn’t available yet." : "Set up a bank account to receive transfers."}</p>
                {onOpenBankAccount ? (
                  <Button onClick={onOpenBankAccount} className="w-full">{account ? "View bank account" : "Set up bank account"}</Button>
                ) : (
                  <Button asChild className="w-full"><Link to="/dashboard?wallet=bank">Bank account</Link></Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Link className="wallet-action wallet-send-action" to="/transfer"><SendHorizontal size={17} aria-hidden="true" /><span>Send</span></Link>
        {onOpenBankAccount ? (
          <button className="wallet-action" type="button" onClick={onOpenBankAccount}><Building2 size={17} aria-hidden="true" /><span>Bank account</span></button>
        ) : (
          <Link className="wallet-action" to="/create-group"><UserPlus size={17} aria-hidden="true" /><span>New group</span></Link>
        )}
        {setShowHistory ? (
          <button className="wallet-action" type="button" onClick={() => setShowHistory(true)}><Clock size={17} aria-hidden="true" /><span>History</span></button>
        ) : (
          <Link className="wallet-action" to="/wallet-history"><Clock size={17} aria-hidden="true" /><span>History</span></Link>
        )}
      </div>
    </div>
  );
}
