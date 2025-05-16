import React, { useState } from "react";
import { format, isValid } from "date-fns";
import { Contribution } from "@/services/localStorage";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import { Button } from "@/components/ui/button";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { RefreshCw, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WalletDetailsProps {
  contribution: Contribution;
}

const WalletDetails = ({ contribution }: WalletDetailsProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testAmount, setTestAmount] = useState("5000");
  const [isSending, setIsSending] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const { refreshData } = useApp();
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };
  
  const refreshBalance = async () => {
    if (!contribution.accountReference) {
      toast.error("This group doesn't have a virtual account set up yet");
      return;
    }
    
    setIsRefreshing(true);
    try {
      // Check for new transactions for this contribution
      await getReservedAccountTransactions(contribution.accountReference);
      
      // Refresh the contribution data to reflect updated balance
      refreshData();
      
      toast.success("Balance refreshed successfully");
    } catch (error) {
      console.error("Error refreshing balance:", error);
      toast.error("Failed to refresh balance");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Function to test real transactions for the group wallet
  const testRealTransaction = async () => {
    if (!contribution.accountReference) {
      toast.error("This group doesn't have a virtual account set up yet");
      return;
    }
    
    setIsRefreshing(true);
    try {
      // Make an API call to the test endpoint
      const response = await fetch('/api/test/simulate-bank-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 5000, // Fixed amount for testing
          accountReference: contribution.accountReference,
          accountNumber: contribution.accountNumber,
          senderName: "Group Test Sender",
          bankName: "Group Test Bank"
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        toast.success("Test group transaction initiated. Wait for webhook notification");
        // The balance will update automatically when the webhook is received
        // and the transaction is processed
        
        // After a short delay, refresh the transactions
        setTimeout(() => {
          refreshBalance();
        }, 2000);
      } else {
        toast.error("Failed to initiate test group transaction");
      }
    } catch (error) {
      console.error("Error testing real group transaction:", error);
      toast.error("Failed to test group transaction");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const simulateTransfer = async () => {
    if (!contribution.accountNumber) {
      toast.error("This group doesn't have an account number");
      return;
    }
    
    if (!testAmount || parseFloat(testAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsSending(true);
    try {
      // Client-side implementation to directly update localStorage
      const amount = parseFloat(testAmount);
      const paymentReference = `sim_tx_${Date.now()}`;
      
      // 1. Get contributions from localStorage
      const contributionsString = localStorage.getItem('contributions');
      if (!contributionsString) {
        throw new Error('No contributions found');
      }
      
      const contributions = JSON.parse(contributionsString);
      const matchingContribution = contributions.find(c => c.accountNumber === contribution.accountNumber);
      
      if (!matchingContribution) {
        throw new Error('No contribution found with this account number');
      }
      
      // 2. Update contribution amount
      matchingContribution.currentAmount += amount;
      
      // 3. Add to contributors
      if (!matchingContribution.contributors) {
        matchingContribution.contributors = [];
      }
      
      matchingContribution.contributors.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}`,
        name: 'Test User',
        amount: amount,
        date: new Date().toISOString(),
        anonymous: false,
      });
      
      // 4. Save updated contributions
      localStorage.setItem('contributions', JSON.stringify(contributions));
      
      // 5. Create a transaction record
      try {
        const transactionsString = localStorage.getItem('transactions');
        const transactions = transactionsString ? JSON.parse(transactionsString) : [];
        
        const newTransaction = {
          id: crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}`,
          contributionId: matchingContribution.id,
          userId: matchingContribution.creatorId,
          type: 'deposit',
          amount: amount,
          description: `Test contribution to ${matchingContribution.name}`,
          status: 'completed',
          createdAt: new Date().toISOString(),
          reference: paymentReference,
          metaData: {
            senderName: 'Test User',
            bankName: 'Test Bank',
            paymentReference,
          }
        };
        
        transactions.push(newTransaction);
        localStorage.setItem('transactions', JSON.stringify(transactions));
      } catch (error) {
        console.error('Failed to create transaction record:', error);
        // Continue anyway since the contribution was updated
      }
      
      // Success
      toast.success("Test transfer completed successfully");
      setIsTestDialogOpen(false);
      
      // Refresh the contribution data
      refreshData();
    } catch (error) {
      console.error("Error simulating transfer:", error);
      toast.error(error instanceof Error ? error.message : "Failed to simulate transfer");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
      {/* Account Number Display */}
      {contribution && (
        <div className="space-y-4">
          <AccountNumberDisplay 
            accountNumber={contribution.accountNumber || ''} 
            accountName={contribution.name || ''}
            bankName={contribution.bankName || ''}
            accountDetails={contribution.accountDetails}
          />
          
          {/* Add refresh balance button */}
          {contribution.accountReference && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2"
              onClick={refreshBalance}
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Refresh Balance"}
            </Button>
          )}
          
          {/* Test real transaction button */}
          {contribution.accountReference && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center gap-2"
              onClick={testRealTransaction}
              disabled={isRefreshing}
            >
              <Banknote size={16} />
              Test Real Transfer
            </Button>
          )}
          
          {/* Add test transfer button - this is for testing only */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full flex items-center justify-center gap-2"
            onClick={() => setIsTestDialogOpen(true)}
          >
            <Banknote size={16} />
            Simulate Bank Transfer
          </Button>
          
          <div className="text-xs text-muted-foreground p-2 bg-background/50 rounded border">
            <p>Transfer to this account to fund the group wallet. The balance will update automatically.</p>
            {!contribution.accountReference && (
              <p className="mt-1 text-yellow-600">Note: This group doesn't have a virtual account yet.</p>
            )}
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        <span className="text-sm font-medium">Group Details</span>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frequency</span>
          <span className="capitalize">{contribution?.frequency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Members</span>
          <span>{contribution?.members.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Started</span>
          <span>{formatDate(contribution?.startDate)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current Balance</span>
          <span className="font-semibold text-green-600">₦{contribution?.currentAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Target Amount</span>
          <span>₦{contribution?.targetAmount.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Test Transfer Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate Bank Transfer</DialogTitle>
            <DialogDescription>
              This will simulate a bank transfer to the contribution account (for testing only).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-amount">Amount (NGN)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                <Input
                  id="test-amount"
                  type="number"
                  className="pl-8"
                  placeholder="0.00"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This simulates a bank transfer to the contribution account. In a real environment, you would make an actual bank transfer.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsTestDialogOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button 
              onClick={simulateTransfer}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Simulate Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletDetails;
