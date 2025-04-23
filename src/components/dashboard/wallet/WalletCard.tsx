
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import WalletHeader from "./WalletHeader";
import WalletActions from "./WalletActions";
import TransactionHistory from "./TransactionHistory";
import { updateUserBalance } from "@/services/localStorage";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { createPaymentInvoice } from "@/services/walletIntegration";
import { toast } from "sonner";

const WalletCard = () => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currencyType, setCurrencyType] = useState<"NGN" | "USD">("NGN");
  const [depositMethod, setDepositMethod] = useState<"manual" | "card" | "bank">("manual");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  
  const {
    user,
    refreshData,
    transactions
  } = useApp();
  
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
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle currency function - make the entire container clickable
  const toggleCurrency = () => {
    setCurrencyType(prev => prev === "NGN" ? "USD" : "NGN");
  };

  // Filter only the user's wallet-related transactions
  const walletTransactions = transactions.filter(t => 
    t.userId === user?.id && 
    (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal")
  ).slice(0, 5);
  
  const refreshBalance = () => {
    setIsLoading(true);
    fetchTransactions().finally(() => {
      setIsLoading(false);
    });
  };
  
  const handleDeposit = async (e: React.MouseEvent<Element, MouseEvent>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsProcessingDeposit(true);
    
    try {
      if (depositMethod === "manual") {
        // Original manual deposit logic
        updateUserBalance(user.id, user.walletBalance + Number(amount));
        refreshData();
        toast.success(`Successfully deposited ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
      } 
      else if (depositMethod === "card") {
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
          toast.error("Failed to create payment invoice");
        }
      } 
      else if (depositMethod === "bank") {
        // For bank transfer, direct to dashboard to see account details
        if (user.reservedAccount) {
          toast.success("Use your virtual account details to make a bank transfer");
        } else {
          toast.info("You need to set up a virtual account first");
          navigate("/dashboard");
        }
      }
    } catch (error) {
      console.error("Error processing deposit:", error);
      toast.error("Failed to process deposit. Please try again.");
    } finally {
      setIsProcessingDeposit(false);
      setAmount("");
      setIsDepositOpen(false);
    }
  };
  
  const handleWithdraw = (e: React.MouseEvent<Element, MouseEvent>) => {
    // Prevent event bubbling
    e.preventDefault();
    e.stopPropagation();
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(amount) > user.walletBalance) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    updateUserBalance(user.id, user.walletBalance - Number(amount));
    refreshData();
    setAmount("");
    setIsWithdrawOpen(false);
    toast.success(`Successfully withdrew ${currencyType === "NGN" ? "₦" : "$"}${Number(amount).toLocaleString()}`);
  };
  
  const toggleBalance = () => {
    setShowBalance(!showBalance);
  };

  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };

  // Format the balance based on selected currency
  const getFormattedBalance = () => {
    const balance = user?.walletBalance || 0;
    if (currencyType === "NGN") {
      return `₦${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } else {
      const usdBalance = convertToUSD(balance);
      return `$${usdBalance.toFixed(2)}`;
    }
  };
  
  // View transaction details
  const viewTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsOpen(true);
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
      <WalletHeader 
        currencyType={currencyType}
        toggleCurrency={toggleCurrency}
        showBalance={showBalance}
        toggleBalance={toggleBalance}
        getFormattedBalance={getFormattedBalance}
      />
      
      <CardContent className="p-0">
        {!showHistory ? (
          <WalletActions 
            setIsDepositOpen={setIsDepositOpen}
            isDepositOpen={isDepositOpen}
            setIsWithdrawOpen={setIsWithdrawOpen}
            isWithdrawOpen={isWithdrawOpen}
            amount={amount}
            setAmount={setAmount}
            handleDeposit={handleDeposit}
            handleWithdraw={handleWithdraw}
            depositMethod={depositMethod}
            setDepositMethod={setDepositMethod}
            isProcessingDeposit={isProcessingDeposit}
            currencyType={currencyType}
            user={user}
            setShowHistory={setShowHistory}
          />
        ) : (
          <TransactionHistory 
            walletTransactions={walletTransactions}
            viewTransactionDetails={viewTransactionDetails}
            setShowHistory={setShowHistory}
            currencyType={currencyType}
            convertToUSD={convertToUSD}
            selectedTransaction={selectedTransaction}
            isTransactionDetailsOpen={isTransactionDetailsOpen}
            setIsTransactionDetailsOpen={setIsTransactionDetailsOpen}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default WalletCard;
