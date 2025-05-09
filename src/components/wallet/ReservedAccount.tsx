
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clipboard, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { getUserReservedAccount, createUserReservedAccount } from "@/services/walletIntegration";

interface ReservedAccountProps {
  userId: string;
}

const ReservedAccount = ({ userId }: ReservedAccountProps) => {
  const { user, refreshData } = useApp();
  const [reservedAccount, setReservedAccount] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchReservedAccount();
    }
  }, [userId]);

  const fetchReservedAccount = async () => {
    setIsLoading(true);
    try {
      const accountData = getUserReservedAccount(userId);
      setReservedAccount(accountData);
    } catch (error) {
      console.error("Error fetching reserved account:", error);
      toast.error("Could not fetch account details");
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async () => {
    if (!user) {
      toast.error("You need to be logged in to create an account");
      return;
    }
    
    setIsCreating(true);
    try {
      // Call API to create a reserved account
      await createUserReservedAccount({
        userId: user.id,
        customerEmail: user.email,
        customerName: user.name || `${user.firstName} ${user.lastName}`.trim(),
        bvn: "22222222222" // Mock BVN for testing (in real app, would be from user input)
      });
      
      // Refresh data to get the new account
      await refreshData();
      toast.success("Virtual account created successfully!");
      fetchReservedAccount();
    } catch (error) {
      console.error("Error creating reserved account:", error);
      toast.error("Could not create virtual account");
    } finally {
      setIsCreating(false);
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };
  
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-5 w-32 bg-gray-300 animate-pulse rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-300 animate-pulse rounded"></div>
            <div className="h-8 w-full bg-gray-300 animate-pulse rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-300 animate-pulse rounded"></div>
            <div className="h-8 w-full bg-gray-300 animate-pulse rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!reservedAccount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You don't have a virtual account yet. Create one to receive payments directly to your wallet.
          </p>
          <Button 
            onClick={createAccount} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <Clipboard className="mr-2 h-4 w-4" />
                Create Virtual Account
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Virtual Account</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchReservedAccount}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Account Number</p>
          <div className="flex items-center justify-between bg-muted p-3 rounded-md">
            <span className="font-mono text-lg">{reservedAccount.accountNumber}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => copyToClipboard(reservedAccount.accountNumber, "Account number")}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy account number</span>
            </Button>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Bank Name</p>
          <div className="flex items-center justify-between bg-muted p-3 rounded-md">
            <span>{reservedAccount.bankName}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => copyToClipboard(reservedAccount.bankName, "Bank name")}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy bank name</span>
            </Button>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Account Name</p>
          <div className="bg-muted p-3 rounded-md">
            <span>{reservedAccount.accountName}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Use this account number to make transfers to your wallet. Funds will reflect in your wallet balance.
        </p>
      </CardFooter>
    </Card>
  );
};

export default ReservedAccount;
