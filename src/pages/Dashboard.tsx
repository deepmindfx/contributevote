import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Plus, Snowflake } from "lucide-react";
import Header from "@/components/layout/Header";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ReservedAccount from "@/components/wallet/ReservedAccount";
import { WalletFlow } from "@/components/wallet/WalletFlow";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

export default function Dashboard() {
  const { user } = useSupabaseUser();
  const [search, setSearch] = useSearchParams();
  const showBankAccount = search.get("wallet") === "bank";
  const showAddMoney = search.get("wallet") === "add";
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi, ${firstName}` : "Welcome";

  const setWalletMode = (mode: "bank" | "add" | null) => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (mode) next.set("wallet", mode);
      else next.delete("wallet");
      return next;
    }, { replace: true });
  };

  if (showBankAccount) {
    return <WalletFlow title="Bank account" description="Receive transfers directly into your wallet."><ReservedAccount /></WalletFlow>;
  }

  return (
    <div className="dashboard-wallet-mode min-h-dvh">
      <Header mobileGreeting={greeting} />
      <main className="app-page dashboard-page max-w-[82rem]">
        <div className="app-page-intro dashboard-intro desktop-dashboard-hero flex flex-wrap items-center justify-between gap-3">
          <h1 className="app-page-title">{greeting}</h1>
          <Button asChild variant="outline" className="h-11 gap-2 lg:hidden">
            <Link to="/create-group"><Plus size={17} aria-hidden="true" /> Create group</Link>
          </Button>
        </div>

        <div className="dashboard-grid">
          <section className="min-w-0" aria-labelledby="wallet-heading">
            <div className="dashboard-wallet-heading mb-3 flex min-h-11 items-center justify-between gap-2">
              <h2 id="wallet-heading" className="app-section-title">Wallet</h2>
            </div>
            <WalletCard
              onOpenBankAccount={() => setWalletMode("bank")}
              isDepositOpen={showAddMoney}
              setIsDepositOpen={(open) => setWalletMode(open ? "add" : null)}
            />
            <Link to="/fixed-savings" className="mt-3 flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-card-foreground transition-colors hover:bg-accent">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Snowflake size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Ice Vault</span><span className="block text-xs text-muted-foreground">Lock money until a date you choose</span></span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
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
