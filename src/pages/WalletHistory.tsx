import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

const WalletHistory = () => {
  const navigate = useNavigate();
  const { user, transactions } = useApp();
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "vote">("all");
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  
  // Fixed toggle currency function
  const toggleCurrency = () => {
    setCurrencyType(prevType => prevType === "NGN" ? "USD" : "NGN");
  };
  
  // Filter transactions based on the current filter and only show user's transactions
  const filteredTransactions = transactions
    .filter(t => t.userId === user.id)
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
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
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={filter === "all" ? "default" : "outline"} 
              onClick={() => setFilter("all")}
              size="sm"
              className={filter === "all" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
            >
              All
            </Button>
            <Button 
              variant={filter === "deposit" ? "default" : "outline"} 
              onClick={() => setFilter("deposit")}
              size="sm"
              className={filter === "deposit" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
            >
              Deposits
            </Button>
            <Button 
              variant={filter === "withdrawal" ? "default" : "outline"} 
              onClick={() => setFilter("withdrawal")}
              size="sm"
              className={filter === "withdrawal" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
            >
              Withdrawals
            </Button>
            <Button 
              variant={filter === "vote" ? "default" : "outline"} 
              onClick={() => setFilter("vote")}
              size="sm"
              className={filter === "vote" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
            >
              Votes
            </Button>
          </div>
          
          {/* Currency Toggle - Fixed to work correctly */}
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
        
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {filter === "all" 
                ? "All transactions" 
                : filter === "deposit" 
                  ? "Deposit transactions" 
                  : filter === "withdrawal" 
                    ? "Withdrawal transactions" 
                    : "Vote transactions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-start p-3 border rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                      ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : 
                        transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'}`}>
                      {transaction.type === 'deposit' ? (
                        <ArrowDown size={18} />
                      ) : transaction.type === 'withdrawal' ? (
                        <ArrowUp size={18} />
                      ) : (
                        <HelpCircle size={18} />
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium">
                            {transaction.type === 'deposit' ? 'Deposit' : 
                             transaction.type === 'withdrawal' ? 'Withdrawal' : 
                             'Vote'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(transaction.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${
                            transaction.type === 'deposit' ? 'text-[#2DAE75]' : 
                            transaction.type === 'withdrawal' ? 'text-red-500' : ''
                          }`}>
                            {transaction.type === 'deposit' ? '+' : 
                             transaction.type === 'withdrawal' ? '-' : ''}
                            {transaction.amount > 0 ? (
                              currencyType === "NGN" ? 
                                `₦${transaction.amount.toLocaleString()}` : 
                                `$${convertToUSD(transaction.amount).toFixed(2)}`
                            ) : ''}
                          </div>
                          <div className="mt-1">
                            <Badge variant={
                              transaction.status === 'pending' ? 'outline' :
                              transaction.status === 'completed' ? 'default' : 'destructive'
                            }>
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default WalletHistory;
