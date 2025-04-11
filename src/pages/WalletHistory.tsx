
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Building } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletHistory } from "@/hooks/useWalletHistory";
import { Switch } from "@/components/ui/switch";
import FilterButtons from "@/components/wallet/history/FilterButtons";
import TransactionsList from "@/components/wallet/history/TransactionsList";
import BankTransactionsList from "@/components/wallet/history/BankTransactionsList";

const WalletHistory = () => {
  const navigate = useNavigate();
  const {
    user,
    filter,
    setFilter,
    currencyType,
    toggleCurrency,
    filteredTransactions,
    apiTransactions,
    isLoading,
    activeTab,
    setActiveTab,
    convertToUSD,
    refreshBankTransactions
  } = useWalletHistory();
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all your wallet transactions</p>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={(value) => setActiveTab(value as "app" | "bank")} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="app">
              <Wallet className="h-4 w-4 mr-2" />
              App Transactions
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Building className="h-4 w-4 mr-2" />
              Bank Transactions
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="app" className="m-0 mt-6">
            <div className="flex justify-between items-center mb-4">
              <FilterButtons filter={filter} setFilter={setFilter} />
              
              {/* Currency Toggle */}
              <div className="flex items-center bg-green-600/30 dark:bg-green-600/50 rounded-full px-3 py-1.5">
                <span className={`text-xs ${currencyType === 'NGN' ? 'text-foreground' : 'text-muted-foreground'}`}>NGN</span>
                <Switch 
                  checked={currencyType === "USD"}
                  onCheckedChange={toggleCurrency}
                  className="mx-1.5 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-green-500"
                />
                <span className={`text-xs ${currencyType === 'USD' ? 'text-foreground' : 'text-muted-foreground'}`}>USD</span>
              </div>
            </div>
            
            <TransactionsList 
              transactions={filteredTransactions}
              filter={filter}
              currencyType={currencyType}
              convertToUSD={convertToUSD}
            />
          </TabsContent>
          
          <TabsContent value="bank" className="m-0 mt-6">
            <BankTransactionsList 
              hasReservedAccount={!!user?.reservedAccount}
              isLoading={isLoading}
              transactions={apiTransactions}
              currencyType={currencyType}
              convertToUSD={convertToUSD}
              onRefresh={refreshBankTransactions}
            />
          </TabsContent>
        </Tabs>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default WalletHistory;
