
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, ArrowDown, Eye, EyeOff, RefreshCw } from "lucide-react";

const WalletCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalance = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-medium text-sm text-muted-foreground">Total Balance</h3>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refreshBalance}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline">
            <h2 className="text-3xl font-bold tracking-tight">
              {showBalance ? "₦ 265,800.00" : "₦ •••••••"}
            </h2>
            <span className="ml-2 text-sm text-green-500 font-medium">+5.2%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Available Balance</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button className="bg-primary/10 hover:bg-primary/20 text-primary">
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Deposit</span>
          </Button>
          <Button variant="outline">
            <ArrowDown className="mr-2 h-4 w-4" />
            <span>Withdraw</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
