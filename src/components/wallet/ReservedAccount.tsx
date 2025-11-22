
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clipboard, RefreshCw, Plus, ArrowRight, Building } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { WalletService, ReservedAccountData } from "@/services/supabase/walletService";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Form schema for validation - BVN only
const idFormSchema = z.object({
  idNumber: z.string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d+$/, "BVN must contain only digits"),
});

// Define the interface for the form data
interface IdFormData {
  idNumber: string;
}

const ReservedAccount = () => {
  const { user, isAuthenticated, refreshCurrentUser } = useSupabaseUser();
  const [isLoading, setIsLoading] = useState(false);
  const [accountDetails, setAccountDetails] = useState<ReservedAccountData | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showIdForm, setShowIdForm] = useState(false);
  
  // Initialize the form with explicit type
  const form = useForm<IdFormData>({
    resolver: zodResolver(idFormSchema),
    defaultValues: {
      idNumber: "",
    },
  });
  
  useEffect(() => {
    // Load existing virtual account data
    const loadAccountData = async () => {
      if (user?.id) {
        const existingAccount = await WalletService.getVirtualAccount(user.id);
        if (existingAccount) {
          setAccountDetails(existingAccount);
        }
      }
    };
    
    loadAccountData();
  }, [user]);
  
  const handleCreateAccount = async (values?: IdFormData) => {
    setIsLoading(true);
    try {
      if (!user || !user.id) {
        toast.error("User information not available. Please log in again.");
        return;
      }
      
      if (!values) {
        setShowIdForm(true);
        setIsLoading(false);
        return;
      }
      
      // Close the ID form dialog after submission
      setShowIdForm(false);
      
      // Always use "bvn" as the ID type since we only support BVN in the UI
      const result = await WalletService.createVirtualAccount(user.id, "bvn", values.idNumber);
      if (result) {
        console.log("Reserved account created:", result);
        setAccountDetails(result);
        
        // Refresh user data to get the saved account info
        await refreshCurrentUser();
        
        // Check for transactions
        try {
          await WalletService.checkForNewTransactions(user.id);
        } catch (error) {
          console.error("Error checking for transactions:", error);
        }
      }
    } catch (error) {
      console.error("Error creating reserved account:", error);
      toast.error("Failed to create reserved account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      if (!user || !user.id) {
        toast.error("User information not available. Please log in again.");
        return;
      }
      
      // Check for new transactions
      try {
        await WalletService.checkForNewTransactions(user.id);
        await refreshCurrentUser();
        toast.success("Checked for new transactions");
      } catch (error) {
        console.error("Error checking for transactions:", error);
        toast.error("Failed to check for transactions");
      }
    } catch (error) {
      console.error("Error refreshing reserved account:", error);
      toast.error("Failed to refresh account details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  
  const onSubmitIdForm = (values: IdFormData) => {
    handleCreateAccount(values);
  };
  
  if (!accountDetails) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Account</CardTitle>
          <CardDescription>
            Create a dedicated virtual account for easy deposits
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          {isLoading ? (
            <div className="space-y-3 w-full">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-32 mx-auto" />
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-muted-foreground mb-3">
                  You don't have a virtual account yet. Create one to easily fund your wallet from any bank.
                </p>
              </div>
              <Button 
                onClick={() => handleCreateAccount()} 
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Create Virtual Account
              </Button>
              
              {/* BVN Input Dialog */}
              <Dialog open={showIdForm} onOpenChange={setShowIdForm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Provide Your BVN</DialogTitle>
                    <DialogDescription>
                      We need your Bank Verification Number (BVN) to create your virtual account. This is required by financial regulations for identity verification.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitIdForm)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="idNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Verification Number (BVN)</FormLabel>
                            <FormControl>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="Enter your 11-digit BVN"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Your BVN will be saved securely and used for future transactions.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <p className="text-xs text-blue-900 dark:text-blue-200">
                          <strong>Don't know your BVN?</strong> Dial <strong>*565*0#</strong> from your registered phone number to retrieve it.
                        </p>
                      </div>
                      
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowIdForm(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? "Processing..." : "Create Account"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Display account details
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle>Virtual Account</CardTitle>
          <CardDescription>
            Fund your wallet directly from any bank
          </CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="h-8 w-8"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(accountDetails.accountNumber, "Account number")}
                  className="h-6 px-2"
                >
                  <Clipboard size={14} />
                </Button>
              </div>
              <div className="font-mono text-xl bg-muted/50 rounded-md py-2 px-3 flex items-center justify-between">
                {accountDetails.accountNumber || (accountDetails.accounts && accountDetails.accounts.length > 0 
                  ? accountDetails.accounts[0].accountNumber 
                  : "Pending...")}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(accountDetails.bankName, "Bank name")}
                  className="h-6 px-2"
                >
                  <Clipboard size={14} />
                </Button>
              </div>
              <div className="font-medium text-lg bg-muted/50 rounded-md py-2 px-3">
                {accountDetails.bankName || (accountDetails.accounts && accountDetails.accounts.length > 0 
                  ? accountDetails.accounts[0].bankName 
                  : "Pending...")}
              </div>
            </div>
            
            <div className="pt-1">
              <label className="text-sm font-medium text-muted-foreground block mb-1">Account Name</label>
              <div className="font-medium text-lg">
                {accountDetails.accountName || "Pending..."}
              </div>
            </div>
            
            <div className="flex gap-2">
              {!showFullDetails && accountDetails.accounts && accountDetails.accounts.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 mt-2" 
                  onClick={() => setShowFullDetails(true)}
                >
                  Show All Bank Accounts
                  <ArrowRight size={14} className="ml-2" />
                </Button>
              )}
            </div>
            
            <Dialog open={showFullDetails} onOpenChange={setShowFullDetails}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>All Virtual Accounts</DialogTitle>
                  <DialogDescription>
                    Your reserved account is available across multiple banks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                  {accountDetails.accounts?.map((account, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Account Number</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => copyToClipboard(account.accountNumber, "Account number")}
                          className="h-6 px-2"
                        >
                          <Clipboard size={14} />
                        </Button>
                      </div>
                      <div className="font-mono text-lg">{account.accountNumber}</div>
                      
                      <div className="mt-2">
                        <span className="text-sm font-medium text-muted-foreground">Bank</span>
                        <div>{account.bankName}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowFullDetails(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <p className="text-sm text-muted-foreground mt-2">
              Transfer to this account from any bank and your wallet will be credited automatically.
            </p>
            
            {/* Webhook system info */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 mb-2">
                <strong>Automatic Updates:</strong> Your balance will update automatically when you transfer money to this account.
              </p>
              <p className="text-xs text-green-600">
                Powered by real-time webhooks - no manual refresh needed!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservedAccount;
