
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Eye, EyeOff, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import WalletActions from "./wallet/WalletActions";
import { useApp } from "@/contexts/AppContext";

const WalletCard = () => {
  const { user, refreshData } = useApp();
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [formattedBalance, setFormattedBalance] = useState("0");

  useEffect(() => {
    if (user?.walletBalance) {
      setFormattedBalance(user.walletBalance.toLocaleString());
    }
  }, [user?.walletBalance]);

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible);
  };

  return (
    <Card className="overflow-hidden border border-muted shadow-sm">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Wallet</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleBalanceVisibility}>
            {isBalanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>Your available balance</CardDescription>
        
        <div className="mt-6">
          <div className="flex items-center">
            <h3 className="text-3xl font-bold">
              ₦ {isBalanceVisible ? formattedBalance : "•••••"}
            </h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <WalletActions />
      </CardContent>
      
      <CardFooter className="bg-muted/30 px-6 py-4">
        <div className="w-full">
          <Button variant="ghost" className="w-full justify-between" asChild>
            <Link to="/wallet-history">
              <span>Transaction History</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default WalletCard;
