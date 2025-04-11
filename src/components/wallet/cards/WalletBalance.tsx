
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { User } from "@/services/localStorage";
import CurrencyToggle from "@/components/wallet/CurrencyToggle";

interface WalletBalanceProps {
  user: User;
}

const WalletBalance = ({ user }: WalletBalanceProps) => {
  const [showBalance, setShowBalance] = useState(true);
  const { currencyType, getFormattedBalance, toggleCurrency } = useCurrencyConversion();

  const toggleBalance = () => {
    setShowBalance(!showBalance);
  };

  return (
    <div className="wallet-gradient p-6 text-white relative overflow-hidden bg-[#2DAE75]">
      {/* Large circle decorations */}
      <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
      <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
      
      {/* Currency toggle */}
      <CurrencyToggle currencyType={currencyType} onToggle={toggleCurrency} />
      
      <div className="relative z-10 mx-0 my-[5px]">
        <div className="flex justify-between items-center mb-1 my-[6px]">
          <p className="text-sm font-medium text-white/80 mb-0 py-[2px]">Available Balance</p>
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-0">
            {showBalance ? getFormattedBalance(user?.walletBalance || 0) : `${currencyType === "NGN" ? "₦" : "$"}•••••••`}
          </h2>
          <Button variant="ghost" size="icon" onClick={toggleBalance} className="h-8 w-8 text-white hover:bg-white/10 rounded-full">
            {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalletBalance;
