
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface WalletHeaderProps {
  currencyType: "NGN" | "USD";
  toggleCurrency: () => void;
  showBalance: boolean;
  toggleBalance: () => void;
  getFormattedBalance: () => string;
}

const WalletHeader = ({
  currencyType,
  toggleCurrency,
  showBalance,
  toggleBalance,
  getFormattedBalance
}: WalletHeaderProps) => {
  return (
    <div className="wallet-gradient p-6 text-white relative overflow-hidden bg-[#2DAE75]">
      {/* Large circle decorations */}
      <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
      <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
      
      {/* Currency toggle - Make the entire container clickable */}
      <div 
        className="absolute top-5 right-5 flex items-center bg-green-600/50 rounded-full px-3 py-1.5 cursor-pointer"
        onClick={toggleCurrency}
      >
        <span className={`text-xs ${currencyType === 'NGN' ? 'text-white' : 'text-white/60'}`}>NGN</span>
        <div className="mx-1.5 w-10">
          <Switch 
            checked={currencyType === "USD"} 
            onCheckedChange={toggleCurrency} 
            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-green-500" 
          />
        </div>
        <span className={`text-xs ${currencyType === 'USD' ? 'text-white' : 'text-white/60'}`}>USD</span>
      </div>
      
      <div className="relative z-10 mx-0 my-[5px]">
        <div className="flex justify-between items-center mb-1 my-[6px]">
          <p className="text-sm font-medium text-white/80 mb-0 py-[2px]">Available Balance</p>
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-0">
            {showBalance ? getFormattedBalance() : `${currencyType === "NGN" ? "₦" : "$"}•••••••`}
          </h2>
          <Button variant="ghost" size="icon" onClick={toggleBalance} className="h-8 w-8 text-white hover:bg-white/10 rounded-full">
            {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalletHeader;
