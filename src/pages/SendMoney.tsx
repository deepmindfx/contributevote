
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Send, 
  Clock, 
  Wallet, 
  MoreHorizontal, 
  Check,
  Loader2
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Form validation schema
const transferFormSchema = z.object({
  amount: z.string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be greater than 0",
    })
    .refine((val) => parseFloat(val) <= 1000000, {
      message: "Amount must be less than or equal to ₦1,000,000",
    }),
  narration: z.string()
    .min(3, { message: "Narration must be at least 3 characters" })
    .max(100, { message: "Narration cannot exceed 100 characters" }),
  bankCode: z.string().min(1, { message: "Please select a bank" }),
  accountNumber: z.string()
    .length(10, { message: "Account number must be 10 digits" })
    .regex(/^\d+$/, { message: "Account number must contain only digits" }),
  useAsync: z.boolean().default(false),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

const SendMoney = () => {
  const navigate = useNavigate();
  const { user, sendMoney, getSupportedBanks, refreshData } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formValues, setFormValues] = useState<TransferFormValues | null>(null);
  const [banks] = useState(getSupportedBanks());
  const [transferResult, setTransferResult] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  // Initialize form
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      amount: "",
      narration: "",
      bankCode: "",
      accountNumber: "",
      useAsync: false,
    },
  });
  
  // Handle form submission
  const onSubmit = (values: TransferFormValues) => {
    // Check if user has sufficient balance
    if (parseFloat(values.amount) > user.walletBalance) {
      toast.error("Insufficient balance in your wallet");
      return;
    }
    
    // Store values and show confirmation dialog
    setFormValues(values);
    setShowConfirmDialog(true);
  };
  
  // Handle transfer confirmation
  const handleConfirmTransfer = async () => {
    if (!formValues) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await sendMoney(
        parseFloat(formValues.amount),
        formValues.narration,
        formValues.bankCode,
        formValues.accountNumber,
        formValues.useAsync
      );
      
      setTransferResult(result);
      
      if (result.success) {
        setShowConfirmDialog(false);
        setShowSuccessDialog(true);
        refreshData();
      } else {
        setShowConfirmDialog(false);
        toast.error(result.message || "Transfer failed");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("An error occurred while processing the transfer");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get bank name by code
  const getBankName = (code: string) => {
    const bank = banks.find(b => b.code === code);
    return bank ? bank.name : "Selected Bank";
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-xl mx-auto px-4 pt-24 pb-20">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/wallet-history")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Wallet
          </Button>
          <h1 className="text-2xl font-bold">Send Money</h1>
          <p className="text-muted-foreground">Transfer funds to a bank account</p>
        </div>
        
        <Tabs defaultValue="transfer" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="transfer">
              <Send className="h-4 w-4 mr-2" />
              Bank Transfer
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              Recent Transfers
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="transfer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Send Money to Bank Account</CardTitle>
                <CardDescription>
                  Transfer funds directly to any bank account in Nigeria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-2xl font-semibold">₦{user.walletBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2
                    })}</p>
                  </div>
                  <Wallet className="h-10 w-10 text-primary opacity-80" />
                </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₦)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter amount"
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum transfer amount is ₦1,000,000
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="bankCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
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
                          <FormControl>
                            <Input
                              placeholder="Enter 10-digit account number"
                              {...field}
                              maxLength={10}
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
                          <FormLabel>Narration</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="What's this transfer for?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="useAsync"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Use asynchronous processing</FormLabel>
                            <FormDescription>
                              This may be useful for large transfers that take longer to process
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Send Money
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transfers</CardTitle>
                <CardDescription>
                  Your latest money transfers to bank accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.isAuthenticated ? (
                  <div className="space-y-4">
                    {/* List recent transfers here - using existing transaction data */}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Please log in to view your transaction history</p>
                    <Button 
                      className="mt-4"
                      onClick={() => navigate("/auth")}
                    >
                      Log In
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
            <DialogDescription>
              Please review the transfer details before confirming.
            </DialogDescription>
          </DialogHeader>
          
          {formValues && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Amount</p>
                <p className="text-xl font-bold">₦{parseFloat(formValues.amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Recipient Bank</p>
                <p>{getBankName(formValues.bankCode)}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Account Number</p>
                <p>{formValues.accountNumber}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Narration</p>
                <p>{formValues.narration}</p>
              </div>
              
              {formValues.useAsync && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400">
                    You've selected asynchronous processing. The transfer may take longer to complete.
                  </p>
                </div>
              )}
              
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-400">
                  Please note that this transfer cannot be reversed once initiated.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTransfer} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirm Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <Check className="h-6 w-6 mr-2" />
              Transfer {transferResult?.responseBody?.status === "SUCCESS" ? "Completed" : "Initiated"}
            </DialogTitle>
            <DialogDescription>
              {transferResult?.responseBody?.status === "SUCCESS" 
                ? "Your transfer has been successfully completed." 
                : "Your transfer has been initiated and is being processed."}
            </DialogDescription>
          </DialogHeader>
          
          {transferResult && (
            <div className="space-y-4 py-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">₦{transferResult.responseBody?.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}</p>
                  <p className="text-sm text-green-600 mt-1">Transfer {transferResult.responseBody?.status}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{transferResult.responseBody?.destinationAccountName || "Bank Account"}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{transferResult.responseBody?.destinationBankName || getBankName(formValues?.bankCode || "")}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-medium">{transferResult.responseBody?.destinationAccountNumber || formValues?.accountNumber}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{transferResult.responseBody?.reference}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {transferResult.responseBody?.dateCreated 
                      ? new Date(transferResult.responseBody.dateCreated).toLocaleString() 
                      : new Date().toLocaleString()}
                  </span>
                </div>
                
                {transferResult.responseBody?.totalFee > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="font-medium">₦{transferResult.responseBody.totalFee.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="sm:flex-1"
              onClick={() => {
                setShowSuccessDialog(false);
                form.reset();
              }}
            >
              Close
            </Button>
            <Button 
              className="sm:flex-1"
              onClick={() => {
                setShowSuccessDialog(false);
                form.reset();
                // Reset form for new transfer
              }}
            >
              New Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default SendMoney;
