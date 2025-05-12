
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronsUpDown, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { processBankTransfer } from "@/services/wallet/transfers";

// Mock bank data for demonstration
const banks = [
  { name: "Zenith Bank", code: "057" },
  { name: "UBA Bank", code: "033" },
  { name: "GTBank", code: "058" },
  { name: "Access Bank", code: "044" },
  { name: "First Bank", code: "011" },
  { name: "Ali Bank Test", code: "101" }, // Test bank
];

const TransferFormSchema = z.object({
  accountNumber: z.string().min(10, "Account number must be 10 digits").max(10, "Account number must be 10 digits"),
  bankCode: z.string().min(1, "Please select a bank"),
  bankName: z.string().optional(),
  amount: z.number().min(100, "Minimum transfer amount is ₦100").max(1000000, "Maximum transfer amount is ₦1,000,000"),
  recipientName: z.string().min(3, "Recipient name is required"),
  narration: z.string().optional(),
});

type TransferFormValues = z.infer<typeof TransferFormSchema>;

const TransferForm = () => {
  const navigate = useNavigate();
  const { user, refreshData } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [accountLookupLoading, setAccountLookupLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [transactionPin, setTransactionPin] = useState("");
  const [step, setStep] = useState(1);
  const [transferData, setTransferData] = useState<TransferFormValues | null>(null);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(TransferFormSchema),
    defaultValues: {
      accountNumber: "",
      bankCode: "",
      amount: 0,
      recipientName: "",
      narration: "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const watchAccountNumber = watch("accountNumber");
  const watchBankCode = watch("bankCode");
  const watchAmount = watch("amount");
  const watchRecipientName = watch("recipientName");

  // Auto-populate account name for test bank
  useEffect(() => {
    if (watchAccountNumber && watchAccountNumber.length === 10 && watchBankCode === "101") {
      setAccountLookupLoading(true);
      // Simulate API call with a delay
      setTimeout(() => {
        setValue("recipientName", "Ali Test Account");
        setAccountLookupLoading(false);
      }, 1000);
    }
  }, [watchAccountNumber, watchBankCode, setValue]);

  const onSubmit = (data: TransferFormValues) => {
    // Validate that user has sufficient balance
    if ((data.amount + 20) > (user?.walletBalance || 0)) {
      toast.error("Insufficient balance for this transfer");
      return;
    }

    // Set transfer data and open confirmation dialog
    setTransferData({
      ...data,
      bankName: banks.find(bank => bank.code === data.bankCode)?.name || "",
    });
    setConfirmDialogOpen(true);
  };

  const handleConfirmTransfer = () => {
    setConfirmDialogOpen(false);
    setPinDialogOpen(true);
  };

  const handlePinSubmit = async () => {
    if (transactionPin !== "1234" && transactionPin !== "0000") {
      toast.error("Invalid PIN. For testing, use 1234 or 0000");
      setTransactionPin("");
      return;
    }

    setIsLoading(true);
    setPinDialogOpen(false);

    try {
      if (!user || !transferData) {
        toast.error("Missing user or transfer data");
        setIsLoading(false);
        return;
      }

      // Process the bank transfer
      const success = await processBankTransfer({
        amount: transferData.amount,
        recipientAccount: transferData.accountNumber,
        recipientName: transferData.recipientName,
        bankName: transferData.bankName || banks.find(bank => bank.code === transferData.bankCode)?.name || "",
        narration: transferData.narration,
        userId: user.id,
        senderName: `${user.firstName} ${user.lastName}`,
      });

      if (success) {
        // Refresh user data to update balance
        await refreshData();
        
        // Show success message and navigate to wallet history
        toast.success("Transfer successful!");
        navigate("/wallet-history");
      } else {
        toast.error("Transfer failed. Please try again.");
      }
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("An error occurred during transfer");
    } finally {
      setIsLoading(false);
      setTransactionPin("");
    }
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-4"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold">Bank Transfer</h1>
        <p className="text-muted-foreground">Transfer funds directly to bank accounts</p>
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Bank Selection */}
              <div className="space-y-2">
                <Label htmlFor="bank">Select Bank</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedBank ? selectedBank.name : "Select bank..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search bank..." />
                      <CommandEmpty>No bank found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {banks.map((bank) => (
                          <CommandItem
                            key={bank.code}
                            value={bank.name}
                            onSelect={() => {
                              setSelectedBank(bank);
                              setValue("bankCode", bank.code);
                              setValue("bankName", bank.name);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedBank?.code === bank.code
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {bank.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.bankCode && (
                  <p className="text-sm text-red-500">{errors.bankCode.message}</p>
                )}
              </div>

              {/* Account Number Input */}
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  type="text"
                  maxLength={10}
                  {...register("accountNumber", { 
                    required: "Account number is required",
                    minLength: { value: 10, message: "Account number must be 10 digits" },
                    maxLength: { value: 10, message: "Account number must be 10 digits" },
                  })}
                  placeholder="Enter 10-digit account number"
                  className="w-full"
                />
                {errors.accountNumber && (
                  <p className="text-sm text-red-500">{errors.accountNumber.message}</p>
                )}
              </div>

              {/* Account Name Display */}
              <div className="space-y-2">
                <Label htmlFor="recipientName">Account Name</Label>
                <Input
                  id="recipientName"
                  type="text"
                  {...register("recipientName", { required: true })}
                  placeholder={accountLookupLoading ? "Looking up account..." : "Account name will appear here"}
                  className="w-full"
                  readOnly={watchBankCode === "101"}
                  disabled={accountLookupLoading}
                />
                {errors.recipientName && (
                  <p className="text-sm text-red-500">Account name is required</p>
                )}
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  {...register("amount", { 
                    required: "Amount is required",
                    valueAsNumber: true,
                    min: { value: 100, message: "Minimum amount is ₦100" },
                    max: { value: 1000000, message: "Maximum amount is ₦1,000,000" }
                  })}
                  placeholder="Enter amount"
                  className="w-full"
                />
                {errors.amount && (
                  <p className="text-sm text-red-500">{errors.amount.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Transfer fee: ₦20.00</p>
              </div>

              {/* Narration/Description */}
              <div className="space-y-2">
                <Label htmlFor="narration">Narration (Optional)</Label>
                <Input
                  id="narration"
                  type="text"
                  {...register("narration")}
                  placeholder="What's this transfer for?"
                  className="w-full"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#2DAE75] hover:bg-[#249e69]"
                disabled={!watchAccountNumber || !watchBankCode || !watchAmount || !watchRecipientName || isLoading}
              >
                {isLoading ? "Processing..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Confirm Transfer Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
          </DialogHeader>
          {transferData && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-2xl font-bold">₦{transferData.amount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">+ ₦20.00 fee</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="text-sm font-medium">{transferData.recipientName}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">Account</p>
                  <p className="text-sm font-medium">{transferData.accountNumber}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-muted-foreground">Bank</p>
                  <p className="text-sm font-medium">
                    {transferData.bankName || banks.find(bank => bank.code === transferData.bankCode)?.name}
                  </p>
                </div>
                {transferData.narration && (
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground">Narration</p>
                    <p className="text-sm font-medium">{transferData.narration}</p>
                  </div>
                )}
                <div className="flex justify-between pt-2">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-sm font-bold">₦{(transferData.amount + 20).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              className="w-full sm:w-auto bg-[#2DAE75] hover:bg-[#249e69]"
              onClick={handleConfirmTransfer}
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Verification Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Transaction PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please enter your 4-digit transaction PIN to authenticate this transfer.
            </p>
            <p className="text-xs text-muted-foreground">
              (Use 1234 or 0000 for testing)
            </p>

            <div className="flex justify-center py-4">
              <InputOTP maxLength={4} value={transactionPin} onChange={setTransactionPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              className="w-full bg-[#2DAE75] hover:bg-[#249e69]"
              onClick={handlePinSubmit}
              disabled={transactionPin.length !== 4 || isLoading}
            >
              {isLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransferForm;
