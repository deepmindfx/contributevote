import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Wallet } from "lucide-react";
import Header from "@/components/layout/Header";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ReservedAccount from "@/components/wallet/ReservedAccount";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const { user } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [activeTab, setActiveTab] = useState("wallet");
  const firstName = user?.name?.trim().split(/\s+/)[0];

  useEffect(() => {
    refreshContributionData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen">
      <Header />
      <main className="app-page max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div>
            <h1 className="app-page-title">{firstName ? `Hi, ${firstName}` : "Your dashboard"}</h1>
            <p className="mt-1 text-muted-foreground">Manage your wallet and contribution groups.</p>
          </div>
          <Button asChild className="hidden h-11 gap-2 rounded-xl sm:inline-flex">
            <Link to="/create-group"><Plus size={18} /> Create group</Link>
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
            <TabsList className="app-segmented grid w-full grid-cols-2" aria-label="Wallet view">
              <TabsTrigger value="wallet" className="gap-2"><Wallet size={16} /> Wallet</TabsTrigger>
              <TabsTrigger value="account" className="gap-2"><Building2 size={16} /> Bank account</TabsTrigger>
            </TabsList>

            <TabsContent value="wallet" className="mt-3">
              <WalletCard onOpenBankAccount={() => setActiveTab("account")} />
            </TabsContent>
            <TabsContent value="account" className="mt-3">
              <ReservedAccount />
            </TabsContent>
          </Tabs>

          <div className="min-w-0 space-y-6">
            <GroupsList />
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
}
