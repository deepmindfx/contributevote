
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { updateUserBalance } from "@/services/localStorage";
import { createPaymentInvoice } from "@/services/wallet/paymentService";
import { getReservedAccountTransactions } from "@/services/wallet/reservedAccountService";
import TransactionHistory from "@/components/wallet/TransactionHistory";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import WalletBalance from "./cards/WalletBalance";
import WalletActions from "./cards/WalletActions";

const WalletCard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const { user, refreshData, transactions } = useApp();
  const { currencyType } = useCurrencyConversion();
  
  // Load transaction history when component mounts
  useEffect(() => {
    if (user?.reservedAccount?.accountReference) {
      fetchTransactions();
    }
  }, [user?.reservedAccount]);
  
  const fetchTransactions = async () => {
    if (!user?.reservedAccount?.accountReference) return;
    
    setIsLoading(true);
    try {
      await getReservedAccountTransactions(user.reservedAccount.accountReference);
      refreshData();
    } catch (error) {
      console.error("Error fetching transactions:", error);
      // Don't display error toast on the dashboard for better UX
    } finally {
      setIsLoading(false);
    }
  };

  // Filter only the user's wallet-related transactions
  const walletTransactions = transactions.filter(t => 
    t.userId === user?.id && 
    (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal")
  ).slice(0, 5);
  
  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (amount) {
        // Create an invoice for card payment
        const result = await createPaymentInvoice({
          amount: Number(amount),
          description: "Wallet top-up via card",
          customerEmail: user.email,
          customerName: user.name || `${user.firstName} ${user.lastName}`,
          userId: user.id
        });
        
        if (result && result.checkoutUrl) {
          // Open the checkout URL in a new tab
          window.open(result.checkoutUrl, "_blank");
          toast.success("Payment page opened. Complete your payment to fund your wallet.");
        } else {
          // Fallback to manual deposit for demo
          updateUserBalance(Number(amount));
          refreshData();
          toast.success(`Successfully deposited ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
        }
      }
    } catch (error) {
      console.error("Error processing deposit:", error);
      // Fallback to manual deposit for demo
      updateUserBalance(Number(amount));
      refreshData();
      toast.success(`Successfully deposited ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
    } finally {
      setIsLoading(false);
      setAmount("");
      setIsDepositOpen(false);
    }
  };
  
  const handleWithdraw = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(amount) > user.walletBalance) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    updateUserBalance(-Number(amount));
    refreshData();
    setAmount("");
    setIsWithdrawOpen(false);
    toast.success(`Successfully withdrew ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
      <WalletBalance user={user} />
      
      <CardContent className="p-0">
        {!showHistory ? (
          <WalletActions 
            isDepositOpen={isDepositOpen}
            setIsDepositOpen={setIsDepositOpen}
            isWithdrawOpen={isWithdrawOpen}
            setIsWithdrawOpen={setIsWithdrawOpen}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            amount={amount}
            setAmount={setAmount}
            isLoading={isLoading}
            handleDeposit={handleDeposit}
            handleWithdraw={handleWithdraw}
            user={user}
            currencyType={currencyType}
          />
        ) : (
          <TransactionHistory 
            transactions={walletTransactions}
            currencyType={currencyType}
            onBack={() => setShowHistory(false)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default WalletCard;
