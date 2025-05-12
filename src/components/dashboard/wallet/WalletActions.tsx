
import { Link } from "react-router-dom";
import { Clock, PlusCircle, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Wallet, Building } from "lucide-react";
import { User } from "@/services/localStorage/types";
import { useNavigate } from "react-router-dom";

interface WalletActionsProps {
  setIsDepositOpen: (value: boolean) => void;
  isDepositOpen: boolean;
  setIsWithdrawOpen: (value: boolean) => void;
  isWithdrawOpen: boolean;
  amount: string;
  setAmount: (value: string) => void;
  handleDeposit: (e: React.MouseEvent<Element, MouseEvent>) => void;
  handleWithdraw: (e: React.MouseEvent<Element, MouseEvent>) => void;
  depositMethod: "manual" | "card" | "bank";
  setDepositMethod: (value: "manual" | "card" | "bank") => void;
  isProcessingDeposit: boolean;
  currencyType: "NGN" | "USD";
  user: User | null;
  setShowHistory: (value: boolean) => void;
}

const WalletActions = ({
  setIsDepositOpen,
  isDepositOpen,
  setIsWithdrawOpen,
  isWithdrawOpen,
  amount,
  setAmount,
  handleDeposit,
  handleWithdraw,
  depositMethod,
  setDepositMethod,
  isProcessingDeposit,
  currencyType,
  user,
  setShowHistory
}: WalletActionsProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 overflow-hidden">
      <div className="grid grid-cols-3 gap-1 pt-2 px-4">
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
            
            <DialogFooter className="flex space-x-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDepositOpen(false);
                }}
                type="button"
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleDeposit} 
                disabled={isProcessingDeposit}
                type="button"
              >
                {isProcessingDeposit ? "Processing..." : "Deposit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Send button */}
        <div 
          className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
          onClick={() => navigate("/transfer")}
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
            <SendHorizontal size={20} />
          </div>
          <span className="text-xs">Send</span>
        </div>
        
        {/* History button */}
        <div 
          className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
          onClick={() => setShowHistory(true)}
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
            <Clock size={20} />
          </div>
          <span className="text-xs">History</span>
        </div>
      </div>
    </div>
  );
};

export default WalletActions;
