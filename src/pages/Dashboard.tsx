import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ReservedAccount from "@/components/wallet/ReservedAccount";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";

export default function Dashboard() {
  const { user } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [search, setSearch] = useSearchParams();
  const showBankAccount = search.get("wallet") === "bank";
  const showAddMoney = search.get("wallet") === "add";
  const walletHeading = useRef<HTMLHeadingElement>(null);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi, ${firstName}` : "Welcome";

  useEffect(() => {
    void refreshContributionData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setWalletMode = (mode: "bank" | "add" | null) => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (mode) next.set("wallet", mode);
      else next.delete("wallet");
      return next;
    }, { replace: true });
  };

  const changeWalletView = (showAccount: boolean) => {
    setWalletMode(showAccount ? "bank" : null);
    requestAnimationFrame(() => walletHeading.current?.focus({ preventScroll: true }));
  };

  return (
    <div className={showBankAccount ? "min-h-dvh" : "dashboard-wallet-mode min-h-dvh"}>
      <Header mobileGreeting={showBankAccount ? undefined : greeting} />
      <main className="app-page dashboard-page max-w-[82rem]">
        <div className="app-page-intro dashboard-intro flex flex-wrap items-center justify-between gap-3">
          <h1 className="app-page-title">{greeting}</h1>
          <Button asChild variant="outline" className="h-11 gap-2 lg:hidden">
            <Link to="/create-group"><Plus size={17} aria-hidden="true" /> Create group</Link>
          </Button>
        </div>

        <div className="dashboard-grid">
          <section className="min-w-0" aria-labelledby="wallet-heading">
            <div className="dashboard-wallet-heading mb-3 flex min-h-11 items-center justify-between gap-2">
              <h2 id="wallet-heading" ref={walletHeading} tabIndex={-1} className="app-section-title rounded-sm">
                {showBankAccount ? "Bank account" : "Wallet"}
              </h2>
              {showBankAccount && (
                <Button variant="ghost" onClick={() => changeWalletView(false)} className="text-primary">
                  <ChevronLeft size={16} aria-hidden="true" /> Back to wallet
                </Button>
              )}
            </div>
            {showBankAccount
              ? <ReservedAccount />
              : <WalletCard
                  onOpenBankAccount={() => changeWalletView(true)}
                  isDepositOpen={showAddMoney}
                  setIsDepositOpen={(open) => setWalletMode(open ? "add" : null)}
                />}
          </section>

          <section className="min-w-0" aria-labelledby="groups-heading">
            <GroupsList />
          </section>
          <section className="min-w-0 lg:col-span-2" aria-labelledby="activity-heading">
            <RecentActivity />
          </section>
        </div>
      </main>
    </div>
  );
}
