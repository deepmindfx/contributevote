
import { useState } from "react";

export const useCurrencyConversion = (initialType: "NGN" | "USD" = "NGN") => {
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">(initialType);
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
  // Format the balance based on selected currency
  const getFormattedBalance = (balance: number) => {
    if (currencyType === "NGN") {
      return `₦${balance.toLocaleString()}`;
    } else {
      const usdBalance = convertToUSD(balance);
      return `$${usdBalance.toFixed(2)}`;
    }
  };
  
  // Toggle currency function
  const toggleCurrency = () => {
    setCurrencyType(prev => prev === "NGN" ? "USD" : "NGN");
  };
  
  return {
    currencyType,
    setCurrencyType,
    convertToUSD,
    getFormattedBalance,
    toggleCurrency
  };
};
