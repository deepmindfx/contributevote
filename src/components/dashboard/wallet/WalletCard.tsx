
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import WalletHeader from "./WalletHeader";
import WalletActions from "./WalletActions";

interface WalletCardProps {
  user: any;
  balance: number;
  onFundWallet: () => void;
  onWithdrawFunds: () => void;
}

const WalletCard = ({ user, balance, onFundWallet, onWithdrawFunds }: WalletCardProps) => {
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [showBalance, setShowBalance] = useState(true);
  
  const toggleCurrency = () => {
    setCurrencyType(prevType => prevType === "NGN" ? "USD" : "NGN");
  };

  const toggleBalance = () => {
    setShowBalance(prev => !prev);
  };

  const getFormattedBalance = () => {
    if (currencyType === "NGN") {
      return `₦${balance.toLocaleString()}`;
    } else {
      // Simple conversion rate for demo purposes
      const usdAmount = balance / 1500;
      return `$${usdAmount.toFixed(2)}`;
    }
  };
  
  return (
    <Card className="glass-card border-2 border-green-100 dark:border-green-900">
      <CardContent className="p-0">
        <WalletHeader 
          currencyType={currencyType}
          toggleCurrency={toggleCurrency}
          showBalance={showBalance}
          toggleBalance={toggleBalance}
          getFormattedBalance={getFormattedBalance}
        />
        
        <div className="p-6">
          <WalletActions 
            onFundWallet={onFundWallet}
            onWithdrawFunds={onWithdrawFunds}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletCard;
