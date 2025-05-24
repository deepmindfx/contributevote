
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { WalletHeader } from "./WalletHeader";
import { WalletActions } from "./WalletActions";

interface WalletCardProps {
  user: any;
  balance: number;
  onFundWallet: () => void;
  onWithdrawFunds: () => void;
}

const WalletCard = ({ user, balance, onFundWallet, onWithdrawFunds }: WalletCardProps) => {
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  
  const toggleCurrency = () => {
    setCurrencyType(prevType => prevType === "NGN" ? "USD" : "NGN");
  };
  
  return (
    <Card className="glass-card border-2 border-green-100 dark:border-green-900">
      <CardContent className="p-6">
        <WalletHeader 
          balance={balance} 
          currencyType={currencyType}
          toggleCurrency={toggleCurrency}
        />
        
        <WalletActions 
          onFundWallet={onFundWallet}
          onWithdrawFunds={onWithdrawFunds}
        />
      </CardContent>
    </Card>
  );
};

export default WalletCard;
