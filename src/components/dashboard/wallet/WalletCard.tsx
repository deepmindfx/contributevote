
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import WalletHeader from "./WalletHeader";
import WalletActions from "./WalletActions";
import TransactionHistory from "./TransactionHistory";
import { updateUserBalance } from "@/services/localStorage";
import { getReservedAccountTransactions, createPaymentInvoice } from "@/services/walletIntegration";
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
    (t.contributionId === "" || t.type === "deposit" || t.type === "withdrawal" || t.type === "transfer")
  ).slice(0, 5);
  
  console.log('Filtered wallet transactions:', walletTransactions);
  
  const refreshBalance = () => {
    setIsLoading(true);
    fetchTransactions().finally(() => {
      setIsLoading(false);
    });
  };
  
  const handleDeposit = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsProcessingDeposit(true);
    try {
      // Your deposit logic here
      if (user && user.id) {
        await updateUserBalance(user.id, Number(amount));
        await refreshData();
        setIsDepositOpen(false);
        toast.success("Deposit successful");
      }
    } catch (error) {
      toast.error("Failed to process deposit");
    } finally {
      setIsProcessingDeposit(false);
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
    setShowBalance(prev => !prev);
  };

  // Convert NGN to USD (simplified conversion rate)
  const convertToUSD = (amount: number) => {
    return amount / 1550; // Using a simplified conversion rate of 1 USD = 1550 NGN
  };

  // Format the balance based on selected currency
  const getFormattedBalance = () => {
    if (!user?.wallet) return "0.00";
    const balance = user.wallet.balance;
    return currencyType === "NGN" 
      ? `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${(balance / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  // View transaction details
  const viewTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionDetailsOpen(true);
  };

  const testChargeCompleted = async () => {
    try {
      console.log('Testing charge completed webhook...');
      const response = await fetch('http://localhost:9000/api/test/simulate-charge-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 5000,
          userId: user?.id,
          tx_ref: `TEST_TX_${Date.now()}`
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      try {
        const data = await response.json();
        console.log('Test charge completed response:', data);
        toast.success('Test charge completed successfully');
        refreshData();
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        toast.error('Received invalid response from server');
        throw parseError;
      }
    } catch (error) {
      console.error('Error testing charge completed webhook:', error);
      toast.error('Failed to test charge completed webhook');
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
      <WalletHeader 
        currencyType={currencyType}
        toggleCurrency={setCurrencyType}
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
            onFundWallet={handleDeposit}
            onWithdrawFunds={handleWithdraw}
            depositMethod={depositMethod}
            setDepositMethod={setDepositMethod}
            isProcessingDeposit={isProcessingDeposit}
            currencyType={currencyType}
            user={user}
            setShowHistory={setShowHistory}
            testChargeCompleted={testChargeCompleted}
          />
        ) : (
          <TransactionHistory 
            walletTransactions={walletTransactions}
            viewTransactionDetails={viewTransactionDetails}
            setShowHistory={setShowHistory}
            currencyType={currencyType}
            convertToUSD={(amount) => amount / 1000}
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
