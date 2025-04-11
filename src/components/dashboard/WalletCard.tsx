
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Plus, Wallet, Send, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";

const WalletCard = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [showUSD, setShowUSD] = useState(false);
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
  // Toggle currency display
  const toggleCurrency = () => {
    setShowUSD(!showUSD);
  };
  
  // Format wallet balance with 2 decimal places
  const formattedNGNBalance = user?.walletBalance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00";
  
  // Format USD balance
  const formattedUSDBalance = convertToUSD(user?.walletBalance || 0).toFixed(2);
  
  return (
    <Card className="mb-6 relative group overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#2DAE75]/10 to-transparent"></div>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">My Wallet</h3>
            <p className="text-sm text-muted-foreground">Available Balance</p>
          </div>
          <Wallet className="h-6 w-6 text-[#2DAE75]" />
        </div>
        
        <div className="flex items-center mb-6">
          <h2 className="text-3xl font-bold">
            {!showUSD ? 
              `₦${formattedNGNBalance}` : 
              `$${formattedUSDBalance}`}
          </h2>
          <Toggle 
            className="ml-3 bg-green-600/30 dark:bg-green-600/50 h-8 px-2"
            onClick={toggleCurrency}
            pressed={showUSD}
          >
            <span className="text-xs">{!showUSD ? "NGN" : "USD"}</span>
          </Toggle>
        </div>
        
        <div className="flex justify-between gap-2">
          <Button 
            className="flex-1 bg-[#2DAE75] hover:bg-[#249e69]"
            onClick={() => navigate("/wallet-history")}
          >
            <Eye className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button 
            className="flex-1 bg-[#2DAE75] hover:bg-[#249e69]"
            onClick={() => navigate("/send-money")}
          >
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
