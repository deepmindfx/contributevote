
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { PlusCircle, SendHorizontal, UserPlus, Clock, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { createPaymentInvoice, getReservedAccountTransactions } from "@/services/walletIntegration";
import CurrencyToggle from "@/components/wallet/CurrencyToggle";
import ActionButton from "@/components/wallet/ActionButton";
import DepositDialog from "@/components/wallet/DepositDialog";
import WithdrawDialog from "@/components/wallet/WithdrawDialog";
import TransactionHistory from "@/components/wallet/TransactionHistory";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";

const WalletCard = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const {
    user,
    refreshData,
    transactions
  } = useApp();
  
  const {
    currencyType,
    getFormattedBalance,
    toggleCurrency
  } = useCurrencyConversion();
  
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
  
  const toggleBalance = () => {
    setShowBalance(!showBalance);
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
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
      
      <CardContent className="p-0">
        {!showHistory ? (
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
            <div className="grid grid-cols-4 gap-1 pt-2 px-4">
              <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
                <ActionButton 
                  icon={<PlusCircle size={20} />} 
                  label="Top Up"
                  isDialogTrigger={true}
                />
                <DepositDialog
                  currencyType={currencyType}
                  isLoading={isLoading}
                  amount={amount}
                  setAmount={setAmount}
                  onDeposit={handleDeposit}
                  onClose={() => setIsDepositOpen(false)}
                  user={user}
                />
              </Dialog>
              
              <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                <ActionButton 
                  icon={<SendHorizontal size={20} />} 
                  label="Send"
                  isDialogTrigger={true}
                />
                <WithdrawDialog
                  currencyType={currencyType}
                  amount={amount}
                  setAmount={setAmount}
                  onWithdraw={handleWithdraw}
                  onClose={() => setIsWithdrawOpen(false)}
                />
              </Dialog>
              
              <Link to="/create-group">
                <ActionButton 
                  icon={<UserPlus size={20} />} 
                  label="Group"
                />
              </Link>
              
              <ActionButton 
                icon={<Clock size={20} />} 
                label="History"
                onClick={() => setShowHistory(true)}
              />
            </div>
          </div>
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
