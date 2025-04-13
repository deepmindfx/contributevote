
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { createPaymentInvoice, getUserReservedAccount, createUserReservedAccount } from "@/services/walletIntegration";
import { toast } from "sonner";

interface WalletCardProps {
  showBalance?: boolean;
}

const WalletCard = ({ showBalance = true }: WalletCardProps) => {
  const { user, refreshUser } = useApp();
  const [showFundDialog, setShowFundDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [idType, setIdType] = useState("bvn");
  const [idNumber, setIdNumber] = useState("");
  
  const handleFund = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const invoiceData = {
        amount: parseFloat(amount),
        description: "Fund wallet",
        customerEmail: user.email,
        customerName: user.name || `${user.firstName} ${user.lastName}`,
        userId: user.id
      };
      
      const response = await createPaymentInvoice(invoiceData);
      
      if (response && response.success) {
        // Redirect to payment page
        window.location.href = response.checkoutUrl;
      } else {
        toast.error(response?.message || "Failed to create payment invoice");
      }
    } catch (error) {
      console.error("Error funding wallet:", error);
      toast.error("An error occurred while processing your request");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (parseFloat(amount) > user.walletBalance) {
      toast.error("Insufficient balance");
      return;
    }
    
    // For demo, just show a success message
    toast.success(`Withdrawal of NGN ${amount} initiated successfully`);
    
    // Close dialog
    setShowWithdrawDialog(false);
    setAmount("");
  };
  
  const handleCreateAccount = async () => {
    if (!idNumber) {
      toast.error("Please enter your BVN or NIN");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await createUserReservedAccount(user.id, idType, idNumber);
      
      if (response) {
        toast.success("Virtual account created successfully");
        refreshUser();
        setShowDetailsDialog(false);
      } else {
        toast.error("Failed to create virtual account");
      }
    } catch (error) {
      console.error("Error creating virtual account:", error);
      toast.error("An error occurred while creating your virtual account");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold flex items-center">
            <Wallet className="mr-2 h-5 w-5" /> Wallet
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>Your CollectiPay virtual wallet</CardDescription>
      </CardHeader>
      <CardContent>
        {showBalance && (
          <div className="text-2xl font-bold">
            NGN {user.walletBalance.toLocaleString()}
          </div>
        )}
        
        {isExpanded && (
          <div className="mt-3 grid gap-2">
            <div className="text-sm">
              <span className="font-medium">Status:</span>{" "}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  user.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {user.status === "active" ? "Active" : "Paused"}
              </span>
            </div>
            
            {user.reservedAccount ? (
              <div className="text-sm">
                <div className="font-medium mb-1">Virtual Account:</div>
                <div className="grid grid-cols-2 gap-1">
                  <div>Bank:</div>
                  <div className="font-medium">
                    {user.reservedAccount.bankName || "Wema Bank"}
                  </div>
                  <div>Account Number:</div>
                  <div className="font-medium">
                    {user.reservedAccount.accountNumber}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setShowDetailsDialog(true)}
                >
                  Create Virtual Account
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setShowWithdrawDialog(true)}>
          Withdraw
        </Button>
        <Button onClick={() => setShowFundDialog(true)}>Fund</Button>
      </CardFooter>
      
      {/* Fund Dialog */}
      <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Your Wallet</DialogTitle>
            <DialogDescription>
              Enter the amount you want to add to your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount (NGN)
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFundDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFund} disabled={isLoading}>
              {isLoading ? "Processing..." : "Continue to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="withdraw-amount" className="text-right">
                Amount (NGN)
              </Label>
              <Input
                id="withdraw-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw}>Withdraw</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Virtual Account Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Virtual Account</DialogTitle>
            <DialogDescription>
              Provide your verification details to create a virtual account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="id-type" className="text-right">
                ID Type
              </Label>
              <select
                id="id-type"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="bvn">BVN</option>
                <option value="nin">NIN</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="id-number" className="text-right">
                ID Number
              </Label>
              <Input
                id="id-number"
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Enter your BVN or NIN"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WalletCard;
