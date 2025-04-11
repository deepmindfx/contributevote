
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { getReservedAccountTransactions } from "@/services/wallet/reservedAccountService";

export const useWalletHistory = () => {
  const { user, transactions, refreshData } = useApp();
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "vote">("all");
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [apiTransactions, setApiTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"app" | "bank">("app");
  
  // Fetch reserved account transactions on component mount and when tab changes
  useEffect(() => {
    const fetchReservedAccountTransactions = async () => {
      if (user?.reservedAccount?.accountReference) {
        setIsLoading(true);
        try {
          const result = await getReservedAccountTransactions(user.reservedAccount.accountReference);
          if (result && result.content) {
            setApiTransactions(result.content);
            // After fetching transactions, refresh app data to update balances
            refreshData();
          }
        } catch (error) {
          console.error("Error fetching reserved account transactions:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    if (activeTab === "bank") {
      fetchReservedAccountTransactions();
    }
  }, [user?.reservedAccount?.accountReference, activeTab, refreshData]);
  
  // Toggle currency function
  const toggleCurrency = () => {
    setCurrencyType(prevType => prevType === "NGN" ? "USD" : "NGN");
  };
  
  // Filter transactions based on the current filter and only show user's transactions
  const filteredTransactions = transactions
    .filter(t => t.userId === user?.id)
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };
  
  // Refresh bank transactions
  const refreshBankTransactions = async () => {
    if (user?.reservedAccount?.accountReference) {
      setIsLoading(true);
      try {
        const result = await getReservedAccountTransactions(user.reservedAccount.accountReference);
        if (result && result.content) {
          setApiTransactions(result.content);
          refreshData();
        }
      } catch (error) {
        console.error("Error refreshing bank transactions:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    user,
    filter,
    setFilter,
    currencyType,
    setCurrencyType,
    toggleCurrency,
    filteredTransactions,
    apiTransactions,
    isLoading,
    activeTab,
    setActiveTab,
    convertToUSD,
    refreshBankTransactions
  };
};
