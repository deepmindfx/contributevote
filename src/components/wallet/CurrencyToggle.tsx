
import React from "react";
import { Switch } from "@/components/ui/switch";

interface CurrencyToggleProps {
  currencyType: "NGN" | "USD";
  onToggle: () => void;
}

const CurrencyToggle = ({ currencyType, onToggle }: CurrencyToggleProps) => {
  return (
    <div className="absolute top-5 right-5 flex items-center bg-green-600/50 rounded-full px-3 py-1.5">
      <span className={`text-xs ${currencyType === 'NGN' ? 'text-white' : 'text-white/60'}`}>NGN</span>
      <Switch 
        checked={currencyType === "USD"} 
        onCheckedChange={onToggle} 
        className="mx-1.5 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-green-500" 
      />
      <span className={`text-xs ${currencyType === 'USD' ? 'text-white' : 'text-white/60'}`}>USD</span>
    </div>
  );
};

export default CurrencyToggle;
