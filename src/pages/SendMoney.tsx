
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Bank, getBanksList, verifyAccount, transferToBank } from "@/services/walletTransfer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, Send, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define the form validation schema for bank transfers
const bankTransferSchema = z.object({
  bankCode: z.string({ required_error: "Please select a bank" }),
  accountNumber: z.string().min(10, "Account number must be at least 10 digits").max(10, "Account number must not exceed 10 digits"),
  amount: z.coerce.number().min(100, "Minimum amount is ₦100").max(1000000, "Maximum amount is ₦1,000,000"),
  narration: z.string().max(100, "Description must not exceed 100 characters").optional(),
  pin: z.string().min(4, "PIN must be 4 digits"),
});

// Define PIN confirmation schema
const pinSchema = z.object({
  pin: z.string().min(4, "PIN must be 4 digits"),
});

const SendMoney = () => {
  const navigate = useNavigate();
  const { user, refreshData } = useApp();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [accountName, setAccountName] = useState("");
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [transferDetails, setTransferDetails] = useState<any>(null);
  
  // Initialize form with react-hook-form
  const form = useForm<z.infer<typeof bankTransferSchema>>({
    resolver: zodResolver(bankTransferSchema),
    defaultValues: {
      bankCode: "",
      accountNumber: "",
      amount: undefined,
      narration: "",
      pin: "",
    },
  });
  
  // PIN confirmation form
  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      pin: "",
    },
  });
  
  // Fetch banks on component mount
  useEffect(() => {
    const fetchBanks = async () => {
      setLoading(true);
      try {
        const banksList = await getBanksList();
        setBanks(banksList.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching banks:", error);
        toast.error("Failed to load banks. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchBanks();
  }, []);
  
  // Find bank by code
  const findBankByCode = (code: string) => {
    const bank = banks.find(b => b.code === code);
    setSelectedBank(bank || null);
    return bank;
  };
  
  // Handle account number verification
  const handleVerifyAccount = async (bankCode: string, accountNumber: string) => {
    if (!bankCode || !accountNumber || accountNumber.length < 10) {
      return;
    }
    
    setVerifying(true);
    setVerificationStatus('idle');
    setAccountName("");
    
    try {
      const result = await verifyAccount(accountNumber, bankCode);
      
      if (result.success && result.accountName) {
        setVerificationStatus('success');
        setAccountName(result.accountName);
      } else {
        setVerificationStatus('error');
        toast.error(result.message || "Failed to verify account");
      }
    } catch (error) {
      console.error("Error verifying account:", error);
      setVerificationStatus('error');
      toast.error("Failed to verify account. Please try again.");
    } finally {
      setVerifying(false);
    }
  };
  
  // Handle bank selection
  const handleBankChange = (value: string) => {
    form.setValue("bankCode", value);
    const bank = findBankByCode(value);
    
    // Reset verification status
    setVerificationStatus('idle');
    setAccountName("");
    
    // If account number is already entered, verify it with the new bank
    const accountNumber = form.getValues("accountNumber");
    if (accountNumber && accountNumber.length === 10) {
      handleVerifyAccount(value, accountNumber);
    }
  };
  
  // Handle account number change
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    form.setValue("accountNumber", value);
    
    // If value is 10 digits and bank is selected, verify the account
    if (value.length === 10 && form.getValues("bankCode")) {
      handleVerifyAccount(form.getValues("bankCode"), value);
    } else {
      // Reset verification status if account number is changed
      setVerificationStatus('idle');
      setAccountName("");
    }
  };
  
  // Handle form submission
  const onSubmit = (values: z.infer<typeof bankTransferSchema>) => {
    if (verificationStatus !== 'success') {
      toast.error("Please verify the account first");
      return;
    }
    
    // Check if user has enough balance
    if (user.walletBalance < values.amount) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    
    // Check if user has PIN set up
    if (!user.pin) {
      toast.error("Please set up a transaction PIN in settings first");
      navigate("/settings");
      return;
    }
    
    // Set transfer details and open confirmation dialog
    setTransferDetails({
      ...values,
      accountName,
      bankName: selectedBank?.name || "",
    });
    setConfirmDialogOpen(true);
  };
  
  // Handle transfer confirmation
  const confirmTransfer = async (values: z.infer<typeof pinSchema>) => {
    if (!transferDetails) return;
    
    setLoading(true);
    try {
      const success = await transferToBank(
        user.id,
        transferDetails.amount,
        transferDetails.bankCode,
        transferDetails.accountNumber,
        transferDetails.narration || `Transfer to ${transferDetails.accountName}`,
        values.pin
      );
      
      if (success) {
        refreshData();
        setConfirmDialogOpen(false);
        form.reset();
        setVerificationStatus('idle');
        setAccountName("");
        navigate("/wallet-history");
      }
    } catch (error) {
      console.error("Error processing transfer:", error);
      toast.error("Failed to process transfer. Please try again.");
    } finally {
      setLoading(false);
      pinForm.reset();
    }
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-md mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Send Money</h1>
          <p className="text-muted-foreground">Transfer funds from your wallet</p>
        </div>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Available Balance</CardTitle>
            <CardDescription>Your current wallet balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-2xl font-bold">₦{user.walletBalance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00"}</span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate("/wallet-history")}
              >
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="bank" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
            <TabsTrigger value="wallet" disabled>Wallet Transfer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bank" className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="bankCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Bank</FormLabel>
                      <Select 
                        onValueChange={handleBankChange}
                        value={field.value}
                        disabled={loading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a bank" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {banks.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>
                              {bank.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="Enter 10-digit account number"
                            maxLength={10}
                            disabled={loading || !form.getValues("bankCode")}
                            onChange={handleAccountNumberChange}
                          />
                        </FormControl>
                        {verifying && (
                          <div className="absolute right-3 top-2.5">
                            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {verificationStatus === 'success' && (
                          <div className="absolute right-3 top-2.5">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>
                        )}
                        {verificationStatus === 'error' && (
                          <div className="absolute right-3 top-2.5">
                            <XCircle className="h-5 w-5 text-red-500" />
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {verificationStatus === 'success' && accountName && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">Account Name:</p>
                    <p className="font-medium">{accountName}</p>
                  </div>
                )}
                
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₦)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          {...field}
                          disabled={loading || verificationStatus !== 'success'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="narration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="What's this transfer for?"
                          {...field}
                          disabled={loading || verificationStatus !== 'success'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full bg-[#2DAE75] hover:bg-[#249e69]" 
                  disabled={loading || verificationStatus !== 'success'}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Continue
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="wallet" className="mt-6">
            <div className="text-center py-10">
              <p className="text-muted-foreground">Wallet-to-wallet transfers are not yet available in this demo</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Confirmation Dialog with PIN entry */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
            <DialogDescription>
              Please confirm the transfer details and enter your transaction PIN
            </DialogDescription>
          </DialogHeader>
          
          {transferDetails && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₦{transferDetails.amount.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{transferDetails.accountName}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{transferDetails.bankName}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-medium">{transferDetails.accountNumber}</span>
                </div>
                
                {transferDetails.narration && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium">{transferDetails.narration}</span>
                  </div>
                )}
              </div>
              
              <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(confirmTransfer)} className="space-y-4">
                  <FormField
                    control={pinForm.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction PIN</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your 4-digit PIN"
                            maxLength={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setConfirmDialogOpen(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-[#2DAE75] hover:bg-[#249e69]"
                      disabled={loading}
                    >
                      {loading ? 
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : 
                        <Send className="mr-2 h-4 w-4" />
                      }
                      {loading ? "Processing..." : "Confirm Transfer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default SendMoney;
