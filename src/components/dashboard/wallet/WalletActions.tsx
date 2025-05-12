
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, SendHorizontal, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Building } from "lucide-react";
import { Link } from "react-router-dom";
import { User } from "@/services/localStorage";

interface WalletActionsProps {
  setIsDepositOpen: (open: boolean) => void;
  isDepositOpen: boolean;
  setIsWithdrawOpen: (open: boolean) => void;
  isWithdrawOpen: boolean;
  amount: string;
  setAmount: (amount: string) => void;
  handleDeposit: (e: React.MouseEvent) => void;
  handleWithdraw: (e: React.MouseEvent) => void;
  depositMethod: "manual" | "card" | "bank";
  setDepositMethod: (method: "manual" | "card" | "bank") => void;
  isProcessingDeposit: boolean;
  currencyType: "NGN" | "USD";
  user: User;
  setShowHistory: (show: boolean) => void;
}

const WalletActions = ({
  setIsDepositOpen,
  isDepositOpen,
  amount,
  setAmount,
  handleDeposit,
  depositMethod,
  setDepositMethod,
  isProcessingDeposit,
  currencyType,
  setShowHistory
}: WalletActionsProps) => {
  // State for the deposit dialog tabbing
  const [activeDepositTab, setActiveDepositTab] = useState<"card" | "bank">("card");

  return (
    <div className="bg-white dark:bg-black/40 rounded-t-3xl -mt-3 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Button 
          onClick={() => setIsDepositOpen(true)} 
          className="bg-[#2DAE75] hover:bg-[#249e69] py-4 h-auto" 
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Money
        </Button>
        
        <Link to="/transfer" className="w-full">
          <Button 
            className="w-full bg-white text-[#2DAE75] border border-[#2DAE75] hover:bg-gray-50 py-4 h-auto"
            size="lg"
            variant="outline"
          >
            <SendHorizontal className="mr-2 h-4 w-4" />
            Send Money
          </Button>
        </Link>
        
        <Button 
          variant="outline" 
          onClick={() => setShowHistory(true)}
          className="col-span-2 mt-2 border-dashed border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-50 h-auto py-3"
        >
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Money to Wallet</DialogTitle>
            <DialogDescription>
              Choose a funding method below to add money to your wallet
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="card" value={activeDepositTab} onValueChange={(v) => setActiveDepositTab(v as "card" | "bank")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="card" onClick={() => setDepositMethod("card")}>
                <CreditCard className="h-4 w-4 mr-2" /> Card Payment
              </TabsTrigger>
              <TabsTrigger value="bank" onClick={() => setDepositMethod("bank")}>
                <Building className="h-4 w-4 mr-2" /> Bank Transfer
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="card">
              <div className="space-y-4 py-2 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({currencyType === "NGN" ? "₦" : "$"})</Label>
                  <Input
                    id="amount"
                    placeholder={`Enter amount`}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  You will be redirected to a secure payment page to complete your transaction.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="bank">
              <div className="space-y-4 py-2 pb-4">
                <p className="text-sm">
                  Use your unique virtual account details to make a transfer from any bank app.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({currencyType === "NGN" ? "₦" : "$"})</Label>
                  <Input
                    id="amount"
                    placeholder={`Enter amount`}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="flex-col sm:justify-start sm:space-x-0 sm:space-y-2">
            <Button 
              onClick={handleDeposit} 
              disabled={isProcessingDeposit}
              className="w-full bg-[#2DAE75] hover:bg-[#249e69]"
            >
              {isProcessingDeposit ? "Processing..." : "Proceed"}
            </Button>
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDepositOpen(false);
              }} 
              type="button"
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletActions;
