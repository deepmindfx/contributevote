import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { ChevronDown, Info, ArrowLeft, Lock, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { ApiService } from '@/services/supabase/apiService';
import BrandLoader from '@/components/ui/BrandLoader';
import CollectiPayReceipt from '@/components/receipt/CollectiPayReceipt';

interface Bank {
  code: string;
  name: string;
}

interface TransferFormData {
  amount: number;
  accountNumber: string;
  bankCode: string;
  beneficiaryName: string;
  narration?: string;
}

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
  recipientName: string;
  recipientAccount: string;
  bankName: string;
  narration?: string;
}

interface FlutterwaveTransferResponse {
  status: string;
  message: string;
  data: {
    id: number;
    account_number: string;
    bank_code: string;
    full_name: string;
    created_at: string;
    currency: string;
    debit_currency: string;
    amount: number;
    fee: number;
    status: string;
    reference: string;
    bank_name: string;
    narration?: string;
  };
}

export default function TransferForm() {
  const { user, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const userPreferences = (user?.preferences || {}) as Record<string, any>;
  const userPin = userPreferences.transactionPin || '';
  const userVirtualAccountNumber = userPreferences.virtualAccount?.accountNumber || 'Wallet';
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferData, setTransferData] = useState<TransferFormData | null>(null);
  const [bankName, setBankName] = useState<string>('');
  const [transactionPin, setTransactionPin] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [transferReceipt, setTransferReceipt] = useState<any>(null);
  const [isValidatingAccount, setIsValidatingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [showReceiptOnly, setShowReceiptOnly] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<TransferFormData>();

  const watchAmount = watch('amount', 0);
  const watchBankCode = watch('bankCode', '');
  const watchAccountNumber = watch('accountNumber', '');

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await ApiService.getBanks();
        const banksList = import.meta.env.DEV
          ? [{ name: "Ali Bank Test", code: "TEST001" }, ...(response.data || [])]
          : (response.data || []);
        setBanks(banksList);
        setFilteredBanks(banksList);
      } catch (error) {
        console.error('Error fetching banks:', error);
        toast.error('Failed to fetch banks');
      } finally {
        setIsLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = banks.filter(bank => 
        bank.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBanks(filtered);
    } else {
      setFilteredBanks(banks);
    }
  }, [searchQuery, banks]);

  useEffect(() => {
    if (watchBankCode && banks.length > 0) {
      const selectedBank = banks.find(bank => bank.code === watchBankCode);
      if (selectedBank) {
        setBankName(selectedBank.name);
      }
    }
  }, [watchBankCode, banks]);

  // Update the account validation function
  const validateAccount = async (bankCode: string, accountNumber: string) => {
    setIsValidatingAccount(true);
    setAccountError(null);
    try {
      const response = await ApiService.resolveAccount(bankCode, accountNumber);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to validate account');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Account validation error:', error);
      setAccountError(error.message || 'Failed to validate account. Please try again.');
      throw error;
    } finally {
      setIsValidatingAccount(false);
    }
  };

  useEffect(() => {
    const fetchBeneficiaryName = async () => {
      if (watchBankCode && watchAccountNumber && watchAccountNumber.length === 10) {
        try {
          const data = await validateAccount(watchBankCode, watchAccountNumber);
          if (data.account_name) {
            setValue('beneficiaryName', data.account_name);
            setAccountError(null);
          }
        } catch (error) {
          // Error is already handled in validateAccount
          setValue('beneficiaryName', '');
        }
      } else {
        setValue('beneficiaryName', '');
        setAccountError(null);
      }
    };
    fetchBeneficiaryName();
  }, [watchBankCode, watchAccountNumber, setValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const bankDropdown = document.getElementById('bank-dropdown');
      const bankInput = document.getElementById('bank-input');
      if (bankDropdown && bankInput && !bankDropdown.contains(event.target as Node) && !bankInput.contains(event.target as Node)) {
        setShowBankList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleContinue = (data: TransferFormData) => {
    // Check if user has set a transaction PIN in settings
    if (!userPin) {
      toast.error('Please set your 4-digit transaction PIN in Settings → Security first');
      navigate('/settings?tab=security');
      return;
    }

    const amount = Number(data.amount);
    const totalNeeded = amount + calculateFee(amount);
    if (Number(user?.wallet_balance || 0) < totalNeeded) {
      toast.error(`Insufficient balance. You need ₦${totalNeeded.toLocaleString()} (including transfer fee).`);
      return;
    }
    
    setTransferData({ ...data, amount });
    setShowConfirmation(true);
  };

  const handleBack = () => {
    setShowConfirmation(false);
    setTransactionPin('');
  };

  // Update handleConfirmTransfer
  const handleConfirmTransfer = async () => {
    if (!transferData) return;

    // Validate transaction PIN stored in profile preferences
    if (transactionPin !== userPin) {
      toast.error('Invalid transaction PIN');
      setTransactionPin('');
      return;
    }

    setIsLoading(true);
    try {
      const accountData = await validateAccount(transferData.bankCode, transferData.accountNumber);

      const result = await ApiService.processTransfer({
        amount: Number(transferData.amount),
        accountNumber: transferData.accountNumber,
        bankCode: transferData.bankCode,
        beneficiaryName: accountData.account_name,
        currency: 'NGN',
        narration: transferData.narration
      });

      if (result.status === 'success' && result.data) {
        setTransferReceipt(result.data);
        setShowReceiptOnly(true);
        await Promise.all([refreshCurrentUser(), refreshContributionData()]);
        toast.success(result.message || 'Transfer initiated successfully');
      } else {
        throw new Error(result.message || 'Transfer failed');
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast.error(error.message || 'Failed to complete transfer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace('NGN', '₦');
  };

  const calculateFee = (amount: number) => {
    // Sample fee calculation - adjust as needed
    const fee = amount > 5000 ? 26.5 : 10.75;
    return fee;
  };

  if (showReceiptOnly && transferReceipt) {
    const receiptAmount = Number(transferReceipt.amount || transferData?.amount || 0);
    const receiptFee = Number(transferReceipt.fee ?? calculateFee(receiptAmount));

    return (
      <div className="min-h-[100dvh] bg-background pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-20 flex items-center border-b bg-card/95 px-4 py-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="mr-2 h-11 w-11 shrink-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 pr-11 text-center text-base font-semibold">Transfer Receipt</h1>
        </div>

        <main className="mx-auto w-full max-w-md px-4 py-6">
          <CollectiPayReceipt
            data={{
              kind: 'transfer',
              title: 'Bank Transfer',
              amount: receiptAmount,
              fee: receiptFee,
              status: transferReceipt.status || 'SUCCESSFUL',
              date: transferReceipt.created_at || new Date().toISOString(),
              reference: transferReceipt.reference,
              transactionId: transferReceipt.id ? String(transferReceipt.id) : undefined,
              paymentMethod: 'CollectiPay Wallet Transfer',
              narration: transferReceipt.narration || transferData?.narration,
              sender: {
                label: 'From',
                name: user?.name || user?.email || 'CollectiPay Wallet',
                subtitle: userVirtualAccountNumber,
              },
              recipient: {
                label: 'To',
                name: transferReceipt.full_name || transferData?.beneficiaryName || 'Recipient',
                subtitle: transferReceipt.account_number || transferData?.accountNumber,
                bankName: transferReceipt.bank_name || bankName,
              },
            }}
            onDone={() => navigate('/dashboard')}
            doneLabel="Back to Dashboard"
          />

          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-11 w-full rounded-xl text-sm font-medium text-muted-foreground"
            onClick={() => {
              setShowReceiptOnly(false);
              setShowConfirmation(false);
              setTransferReceipt(null);
              setTransactionPin('');
            }}
          >
            Send another transfer
          </Button>
        </main>
      </div>
    );
  }

  if (showConfirmation && transferData) {
    const fee = calculateFee(transferData.amount);
    
    return (
      <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
        {isLoading && (
          <BrandLoader
            variant="overlay"
            badge="Bank Transfer"
            message={`Sending ${formatCurrency(transferData.amount)}`}
            submessage={`Transferring securely to ${transferData.beneficiaryName}${bankName ? ` • ${bankName}` : ''}…`}
          />
        )}
        <div className="sticky top-0 z-20 flex items-center border-b bg-card/95 px-4 py-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleBack}
            className="mr-2 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Review transfer</h1>
        </div>
        
        <main className="mx-auto flex w-full max-w-md flex-col px-4 py-5">
          {/* Confirmation details */}
          <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">From</span>
                <div className="text-right">
                  <span className="font-medium block">{user?.name || user?.email}</span>
                  <span className="text-sm text-gray-500">{userVirtualAccountNumber}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">To</span>
                <div className="text-right">
                  <span className="font-medium block">{transferData.beneficiaryName}</span>
                  <span className="text-sm text-gray-500">{transferData.accountNumber}</span>
                  <span className="text-sm text-gray-500">{bankName}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time</span>
                <span className="font-medium">{new Date().toLocaleString('en-NG', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-medium text-[#2DAE75]">{formatCurrency(transferData.amount)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Transfer fee</span>
                <span className="font-medium tabular-nums">{formatCurrency(fee)}</span>
              </div>
              {transferData.narration && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Narration</span>
                  <span className="font-medium">{transferData.narration}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t pt-4">
                <span className="font-semibold">Total</span>
                <span className="font-semibold tabular-nums">{formatCurrency(transferData.amount + fee)}</span>
              </div>
            </div>
          </div>
          
          {/* Transaction PIN */}
          <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center mb-4">
              <Lock className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="font-semibold">Enter your transaction PIN</h2>
            </div>
            
            <div className="flex justify-center my-4">
              <InputOTP
                maxLength={4}
                aria-label="Transaction PIN"
                value={transactionPin}
                onChange={setTransactionPin}
                containerClassName="gap-3"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          
          <div className="mt-auto space-y-4">
            <Button
              className="h-12 w-full"
              onClick={handleConfirmTransfer}
              disabled={isLoading || isValidating || transactionPin.length < 4}
            >
              {isLoading ? 'Processing…' : isValidating ? 'Validating…' : 'Confirm transfer'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleBack}
              disabled={isLoading || isValidating}
            >
              Cancel
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-20 flex items-center border-b bg-background/95 px-4 py-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="mr-2 h-11 w-11 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold">Send to a bank account</h1>
      </div>
      
      <main className="w-full px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Daily Transaction Limit Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center">
            <Info className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <span className="text-sm text-amber-800">Account daily transaction limit: ₦500,000.00</span>
          </div>
          
          <form onSubmit={handleSubmit(handleContinue)} className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="space-y-1.5">
              <label htmlFor="bank-input" className="text-sm font-medium">Bank</label>
              <div className="relative">
                <div className="relative">
                  <Input
                    id="bank-input"
                    type="text"
                    placeholder={isLoadingBanks ? "Loading banks..." : "Search banks..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowBankList(true);
                    }}
                    onFocus={() => setShowBankList(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setShowBankList(false);
                    }}
                    autoComplete="off"
                    aria-controls={showBankList && !isLoadingBanks ? "bank-dropdown" : undefined}
                    className="h-12 rounded-xl pr-10"
                    disabled={isLoadingBanks}
                  />
                  {isLoadingBanks ? (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5" />
                  )}
                </div>
                
                {showBankList && !isLoadingBanks && (
                  <div 
                    id="bank-dropdown"
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover shadow-lg"
                  >
                    {filteredBanks.length === 0 ? (
                      <div className="p-3 text-center text-gray-500">No banks found</div>
                    ) : (
                      filteredBanks.map((bank) => (
                        <button
                          type="button"
                          key={bank.code}
                          className="block min-h-11 w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted"
                          onClick={() => {
                            setValue('bankCode', bank.code);
                            setBankName(bank.name);
                            setShowBankList(false);
                            setSearchQuery(bank.name);
                          }}
                        >
                          {bank.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {errors.bankCode && (
                <p className="text-sm text-red-600 mt-1">{errors.bankCode.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="transfer-account" className="text-sm font-medium">Account number</label>
              <Input
                id="transfer-account"
                type="text"
                inputMode="numeric"
                maxLength={10}
                {...register('accountNumber', {
                  required: 'Account number is required',
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Account number must be 10 digits'
                  }
                })}
                className="h-12 rounded-xl"
                placeholder="0123456789"
              />
              {errors.accountNumber && (
                <p className="text-sm text-red-600 mt-1">{errors.accountNumber.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="transfer-amount" className="text-sm font-medium">Amount (₦)</label>
              <div className="relative">
                <Input
                  id="transfer-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: {
                      value: 100,
                      message: 'Minimum amount is ₦100'
                    },
                    max: {
                      value: 500000,
                      message: 'Maximum amount is ₦500,000'
                    }
                  })}
                  className="h-12 rounded-xl"
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="transfer-beneficiary" className="text-sm font-medium">Recipient</label>
              <div className="relative">
                <Input
                  id="transfer-beneficiary"
                  type="text"
                  {...register('beneficiaryName', {
                    required: 'Beneficiary name is required'
                  })}
                  readOnly
                  className={`h-12 rounded-xl bg-muted pr-10 ${accountError ? 'border-destructive' : ''}`}
                  placeholder={isValidatingAccount ? "Verifying account…" : "Appears after bank verification"}
                />
                {isValidatingAccount && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5 animate-spin" />
                )}
                {accountError && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                )}
              </div>
              {accountError && (
                <p className="text-sm text-red-600 mt-1 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {accountError}
                </p>
              )}
              {errors.beneficiaryName && (
                <p className="text-sm text-red-600 mt-1">{errors.beneficiaryName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="transfer-note" className="text-sm font-medium">Note (optional)</label>
              <Input
                id="transfer-note"
                type="text"
                {...register('narration')}
                className="h-12 rounded-xl"
                placeholder="What’s this transfer for?"
              />
            </div>
            
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading || isLoadingBanks}
                className="h-12 w-full rounded-xl"
              >
                {isLoading ? 'Processing...' : isLoadingBanks ? 'Loading banks...' : 'Continue'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
