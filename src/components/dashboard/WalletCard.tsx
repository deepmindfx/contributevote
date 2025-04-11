import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ArrowDown, Wallet, SendHorizontal, UserPlus, Clock, Eye, EyeOff, DollarSign, CreditCard, Building } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserBalance } from "@/services/localStorage";
import { toast } from "sonner";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPaymentInvoice } from "@/services/walletIntegration";

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
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: ""
  });
  
  const {
    user,
    refreshData,
    isAdmin,
    transactions
  } = useApp();

  // Toggle currency function
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
    setTimeout(() => {
      refreshData();
      setIsLoading(false);
    }, 1000);
  };
  
  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (depositMethod === "manual") {
        // Original manual deposit logic
        updateUserBalance(Number(amount));
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
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
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
      return `₦${balance.toLocaleString()}`;
    } else {
      const usdBalance = convertToUSD(balance);
      return `$${usdBalance.toFixed(2)}`;
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-0 shadow-none">
      <div className="wallet-gradient p-6 text-white relative overflow-hidden bg-[#2DAE75]">
        {/* Large circle decorations */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full border border-white/10 opacity-20"></div>
        
        {/* Currency toggle - Updated to match reference image */}
        <div className="absolute top-5 right-5 flex items-center bg-green-600/50 rounded-full px-3 py-1.5">
          <span className={`text-xs ${currencyType === 'NGN' ? 'text-white' : 'text-white/60'}`}>NGN</span>
          <Switch 
            checked={currencyType === "USD"} 
            onCheckedChange={toggleCurrency} 
            className="mx-1.5 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-green-500" 
          />
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
      
      <CardContent className="p-0">
        {!showHistory ? (
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
            <div className="grid grid-cols-4 gap-1 pt-2 px-4">
              <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
                <DialogTrigger asChild>
                  <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                      <PlusCircle size={20} />
                    </div>
                    <span className="text-xs">Top Up</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                    <DialogDescription>
                      Add money to your wallet. Choose your preferred method.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={depositMethod} onValueChange={(value) => setDepositMethod(value as "manual" | "card" | "bank")}>
                    <TabsList className="grid grid-cols-3 mb-4">
                      <TabsTrigger value="manual">
                        <Wallet className="h-4 w-4 mr-2" />
                        Manual
                      </TabsTrigger>
                      <TabsTrigger value="card">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Card
                      </TabsTrigger>
                      <TabsTrigger value="bank">
                        <Building className="h-4 w-4 mr-2" />
                        Bank
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="manual" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="deposit-amount">Amount ({currencyType})</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">
                            {currencyType === "NGN" ? "₦" : "$"}
                          </span>
                          <Input id="deposit-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Use this option for demo purposes only. In a real app, this would be replaced by actual payment methods.
                        </p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="card" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-deposit-amount">Amount ({currencyType})</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">
                            {currencyType === "NGN" ? "₦" : "$"}
                          </span>
                          <Input id="card-deposit-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          You'll be redirected to a secure payment page to complete your transaction.
                        </p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="bank" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bank-deposit-amount">Amount ({currencyType})</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">
                            {currencyType === "NGN" ? "₦" : "$"}
                          </span>
                          <Input id="bank-deposit-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                        
                        {user?.reservedAccount ? (
                          <div className="p-3 bg-muted/50 rounded-md text-sm">
                            <p className="font-medium">Your Virtual Account:</p>
                            <p className="mt-1">{user.reservedAccount.bankName}</p>
                            <p className="font-mono">{user.reservedAccount.accountNumber}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Transfer the amount to this account and your wallet will be credited automatically.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            You need to set up a virtual account first. This will require your BVN or NIN for verification.
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeposit} disabled={isLoading}>
                      {isLoading ? "Processing..." : "Deposit"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                <DialogTrigger asChild>
                  <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                      <SendHorizontal size={20} />
                    </div>
                    <span className="text-xs">Send</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                    <DialogDescription>
                      Withdraw money from your wallet. Enter the amount you want to withdraw.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount ({currencyType})</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">
                          {currencyType === "NGN" ? "₦" : "$"}
                        </span>
                        <Input id="withdraw-amount" type="number" className="pl-8" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
                    <Button onClick={handleWithdraw}>Withdraw</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
                <Link to="/create-group" className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                    <UserPlus size={20} />
                  </div>
                  <span className="text-xs">Group</span>
                </Link>
              </div>
              
              <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors" onClick={() => setShowHistory(true)}>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
                  <Clock size={20} />
                </div>
                <span className="text-xs">History</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Transactions</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-[#2DAE75]">
                Back
              </Button>
            </div>
            
            {walletTransactions.length > 0 ? (
              <div className="space-y-3">
                {walletTransactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${transaction.type === 'deposit' ? 'bg-green-100 text-[#2DAE75]' : transaction.type === 'withdrawal' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {transaction.type === 'deposit' ? <ArrowDown size={18} /> : <ArrowDown size={18} className="transform rotate-180" />}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-sm">
                          {transaction.type === 'deposit' ? 'Money In' : 'Money Out'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${transaction.type === 'deposit' ? 'text-[#2DAE75]' : 'text-red-500'}`}>
                      {transaction.type === 'deposit' ? '+' : '-'}
                      {currencyType === "NGN" ? `₦${transaction.amount.toLocaleString()}` : `$${convertToUSD(transaction.amount).toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No transaction history yet</p>
              </div>
            )}
            
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/wallet-history")}>
              View All Transactions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletCard;
