
import React, { useState } from "react";
import { 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, CreditCard, Building } from "lucide-react";
import { User } from "@/services/localStorage";

interface DepositDialogProps {
  currencyType: "NGN" | "USD";
  isLoading: boolean;
  amount: string;
  setAmount: (amount: string) => void;
  onDeposit: () => void;
  onClose: () => void;
  user: User;
}

const DepositDialog = ({ 
  currencyType, 
  isLoading, 
  amount, 
  setAmount, 
  onDeposit, 
  onClose,
  user
}: DepositDialogProps) => {
  const [depositMethod, setDepositMethod] = useState<"manual" | "card" | "bank">("manual");

  return (
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
              <Input 
                id="deposit-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
              />
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
              <Input 
                id="card-deposit-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
              />
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
              <Input 
                id="bank-deposit-amount" 
                type="number" 
                className="pl-8" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
              />
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
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onDeposit} disabled={isLoading}>
          {isLoading ? "Processing..." : "Deposit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DepositDialog;
