
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Building, LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";

// Nigerian banks list (expanded)
const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "035A", name: "ALAT by WEMA" },
  { code: "401", name: "ASO Savings and Loans" },
  { code: "50931", name: "Bowen Microfinance Bank" },
  { code: "50823", name: "CEMCS Microfinance Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "562", name: "Ekondo Microfinance Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "90052", name: "Moniepoint Microfinance Bank" },
  { code: "100002", name: "Opay" },
  { code: "100003", name: "Palmpay" },
  { code: "526", name: "Parallex Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "102", name: "Titan Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" }
];

// Form schema
const formSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
  bankCode: z.string().min(1, "Bank is required"),
  accountNumber: z.string().length(10, "Account number must be 10 digits"),
  narration: z.string().optional(),
  recipientName: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

const SendMoney = () => {
  const navigate = useNavigate();
  const { user, sendMoneyToBank, checkTransferStatus } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [formData, setFormData] = useState<FormValues | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  
  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      bankCode: "",
      accountNumber: "",
      narration: "",
      recipientName: ""
    }
  });
  
  // Handle form submission
  const onSubmit = (data: FormValues) => {
    setFormData(data);
    setShowConfirmDialog(true);
    setTransferError(null);
  };
  
  // Handle confirm transfer
  const handleConfirmTransfer = async () => {
    if (!formData) return;
    
    setIsLoading(true);
    setShowConfirmDialog(false);
    
    try {
      console.log("Sending money with data:", {
        amount: parseFloat(formData.amount),
        destinationBankCode: formData.bankCode,
        destinationAccountNumber: formData.accountNumber,
        narration: formData.narration || "Bank Transfer"
      });
      
      const result = await sendMoneyToBank({
        amount: parseFloat(formData.amount),
        destinationBankCode: formData.bankCode,
        destinationAccountNumber: formData.accountNumber,
        narration: formData.narration || "Bank Transfer",
        recipientName: formData.recipientName
      });
      
      console.log("Transfer result:", result);
      
      setTransferResult(result);
      
      if (result.success) {
        setShowReceiptDialog(true);
        toast.success("Transfer initiated successfully");
      } else {
        setTransferError(result.message);
        toast.error(result.message || "Failed to process transfer");
      }
    } catch (error) {
      console.error("Error processing transfer:", error);
      setTransferError("An unexpected error occurred. Please try again.");
      toast.error("Failed to process transfer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if user has a virtual account
  const hasVirtualAccount = !!user?.reservedAccount?.accountNumber;
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-2xl mx-auto px-4 pt-24 pb-12">
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
          <p className="text-muted-foreground">Transfer funds to any bank account</p>
        </div>
        
        {!hasVirtualAccount ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <Alert>
                <Building className="h-4 w-4" />
                <AlertTitle>Virtual Account Required</AlertTitle>
                <AlertDescription>
                  You need to set up a virtual account before you can make transfers.
                  Please go to settings to create your virtual account.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full mt-4"
                onClick={() => navigate("/settings")}
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {transferError && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {transferError}
                </AlertDescription>
              </Alert>
            )}
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl">Transfer Details</CardTitle>
                <CardDescription>
                  Enter recipient account details below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                              <Input 
                                placeholder="0.00"
                                className="pl-8"
                                {...field}
                                type="number"
                                min="1"
                                step="0.01"
                              />
                            </div>
                          </FormControl>
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
                                <SelectValue placeholder="Select bank" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NIGERIAN_BANKS.map((bank) => (
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
                              placeholder="Enter 10 digit account number"
                              {...field}
                              maxLength={10}
                              minLength={10}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="recipientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Name (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter recipient name"
                              {...field}
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
                          <FormLabel>Transfer Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="What's this transfer for?"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        className="w-full bg-[#2DAE75] hover:bg-[#249e69]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Processing
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send Money
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Wallet balance card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Wallet Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-muted-foreground text-sm">Available Balance</p>
                    <p className="text-2xl font-bold">{formatCurrency(user?.walletBalance || 0)}</p>
                  </div>
                  <Button 
                    onClick={() => navigate("/wallet-history")}
                    variant="outline"
                  >
                    Transaction History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
            <DialogDescription>
              Please review the transfer details before proceeding
            </DialogDescription>
          </DialogHeader>
          
          {formData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Transfer Amount</p>
                <p className="text-2xl font-bold text-[#2DAE75]">
                  {formatCurrency(parseFloat(formData.amount))}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Recipient Bank</p>
                <p>{NIGERIAN_BANKS.find(b => b.code === formData.bankCode)?.name || formData.bankCode}</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Account Number</p>
                <p>{formData.accountNumber}</p>
              </div>
              
              {formData.recipientName && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recipient Name</p>
                  <p>{formData.recipientName}</p>
                </div>
              )}
              
              {formData.narration && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Description</p>
                  <p>{formData.narration}</p>
                </div>
              )}
              
              <Alert>
                <AlertDescription>
                  This transfer will be processed asynchronously and may take a few minutes to complete.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTransfer}
              className="bg-[#2DAE75] hover:bg-[#249e69]"
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Receipt</DialogTitle>
            <DialogDescription>
              Your transfer has been initiated
            </DialogDescription>
          </DialogHeader>
          
          {transferResult && transferResult.success && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75]">
                  <CheckCircle2 size={32} />
                </div>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[#2DAE75]">
                  {formatCurrency(transferResult.amount || 0)}
                </h3>
                <p className="text-muted-foreground">
                  {transferResult.status === "SUCCESS" ? "Transfer Completed" : "Transfer Initiated"}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">
                    {transferResult.status === "SUCCESS" ? "Completed" : 
                     transferResult.status === "PENDING" ? "Processing" : 
                     transferResult.status}
                  </span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{transferResult.reference?.slice(0, 12)}...</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{transferResult.destinationBankName}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-medium">{transferResult.destinationAccountNumber}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{transferResult.destinationAccountName || "Not Available"}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {transferResult.dateCreated ? new Date(transferResult.dateCreated).toLocaleString() : "Now"}
                  </span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-medium">{formatCurrency(transferResult.fee || 0)}</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => navigate("/wallet-history")}
              className="w-full sm:w-auto"
            >
              View All Transactions
            </Button>
            <Button
              onClick={() => setShowReceiptDialog(false)}
              className="w-full sm:w-auto bg-[#2DAE75] hover:bg-[#249e69]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <MobileNav />
    </div>
  );
};

export default SendMoney;
