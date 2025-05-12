import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ChevronDown, Info, ArrowLeft, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';

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

export default function TransferForm() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferData, setTransferData] = useState<TransferFormData | null>(null);
  const [bankName, setBankName] = useState<string>('');
  const [transactionPin, setTransactionPin] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBankList, setShowBankList] = useState(false);

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
        const response = await fetch('/api/banks');
        const data = await response.json();
        setBanks(data.data);
        setFilteredBanks(data.data);
      } catch (error) {
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

  // Update the beneficiary name effect
  useEffect(() => {
    const fetchBeneficiaryName = async () => {
      if (watchBankCode && watchAccountNumber && watchAccountNumber.length === 10) {
        try {
          const response = await fetch(`/api/resolve-account?bankCode=${watchBankCode}&accountNumber=${watchAccountNumber}`);
          const data = await response.json();
          if (data.success && data.data.account_name) {
            setValue('beneficiaryName', data.data.account_name);
          }
        } catch (error) {
          console.error('Failed to fetch beneficiary name:', error);
        }
      }
    };
    fetchBeneficiaryName();
  }, [watchBankCode, watchAccountNumber, setValue]);

  // Add click outside handler for bank dropdown
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
    // Check if user has set a PIN
    if (!user?.pin) {
      toast.error('Please set your transaction PIN in settings first');
      navigate('/settings');
      return;
    }
    
    // Set the transfer data and show confirmation
    setTransferData(data);
    setShowConfirmation(true);
  };

  const handleBack = () => {
    setShowConfirmation(false);
    setTransactionPin('');
  };

  const handleConfirmTransfer = async () => {
    if (!transferData) return;

    // Validate PIN
    if (transactionPin !== user?.pin) {
      toast.error('Invalid transaction PIN');
      setTransactionPin('');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transferData,
          currency: 'NGN'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      toast.success('Transfer completed successfully');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete transfer');
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

  if (showConfirmation && transferData) {
    const fee = calculateFee(transferData.amount);
    
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center p-4 border-b">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleBack}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Confirm Transfer</h1>
        </div>
        
        <div className="flex-1 p-4 overflow-auto max-w-md mx-auto w-full flex flex-col">
          {/* Confirmation details */}
          <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">From</span>
                <span className="font-medium">Savings Account, {user?.accountNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">To</span>
                <span className="font-medium">{transferData.beneficiaryName}, {transferData.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bank</span>
                <span className="font-medium">{bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-medium text-[#2DAE75]">{formatCurrency(transferData.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fee</span>
                <span className="font-medium">₦ {fee.toFixed(2)}</span>
              </div>
              {transferData.narration && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Narration</span>
                  <span className="font-medium">{transferData.narration}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Transaction PIN */}
          <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
            <div className="flex items-center mb-4">
              <Lock className="h-5 w-5 text-gray-500 mr-2" />
              <h3 className="font-medium">Enter Transaction PIN</h3>
            </div>
            
            <div className="flex justify-center my-4">
              <InputOTP 
                maxLength={4} 
                value={transactionPin} 
                onChange={setTransactionPin}
                render={({ slots }) => (
                  <InputOTPGroup>
                    {slots.map((slot, idx) => (
                      <InputOTPSlot key={idx} {...slot} index={idx} className="w-14 h-14 text-xl" />
                    ))}
                  </InputOTPGroup>
                )}
              />
            </div>
          </div>
          
          <div className="mt-auto space-y-4">
            <Button
              className="w-full py-3 bg-[#2DAE75] hover:bg-[#249e69] text-white font-medium"
              onClick={handleConfirmTransfer}
              disabled={isLoading || transactionPin.length < 4}
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleBack}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center p-4 border-b">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Transfer to Bank Account</h1>
      </div>
      
      <div className="flex-1 p-4 overflow-auto w-full">
        <div className="max-w-md mx-auto">
          {/* Daily Transaction Limit Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center">
            <Info className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <span className="text-sm text-amber-800">Account daily transaction limit: ₦500,000.00</span>
          </div>
          
          <form onSubmit={handleSubmit(handleContinue)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Select Bank</label>
              <div className="relative">
                <div className="relative">
                  <Input
                    id="bank-input"
                    type="text"
                    placeholder="Search banks..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowBankList(true);
                    }}
                    onFocus={() => setShowBankList(true)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5" />
                </div>
                
                {showBankList && (
                  <div 
                    id="bank-dropdown"
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
                  >
                    {filteredBanks.map((bank) => (
                      <div
                        key={bank.code}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setValue('bankCode', bank.code);
                          setBankName(bank.name);
                          setShowBankList(false);
                          setSearchQuery(bank.name);
                        }}
                      >
                        {bank.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.bankCode && (
                <p className="text-sm text-red-600 mt-1">{errors.bankCode.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Account Number</label>
              <input
                type="text"
                {...register('accountNumber', {
                  required: 'Account number is required',
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Account number must be 10 digits'
                  }
                })}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                placeholder="0123456789"
              />
              {errors.accountNumber && (
                <p className="text-sm text-red-600 mt-1">{errors.accountNumber.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Amount (₦)</label>
              <div className="relative">
                <input
                  type="number"
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
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Beneficiary Name</label>
              <input
                type="text"
                {...register('beneficiaryName', {
                  required: 'Beneficiary name is required'
                })}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                placeholder="Will be auto-filled"
              />
              {errors.beneficiaryName && (
                <p className="text-sm text-red-600 mt-1">{errors.beneficiaryName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Narration</label>
              <input
                type="text"
                {...register('narration')}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                placeholder="Enter transfer narration"
              />
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading || isLoadingBanks}
                className="w-full py-3 px-4 rounded-lg shadow-sm text-white font-medium bg-[#2DAE75] hover:bg-[#249e69] disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Processing...' : isLoadingBanks ? 'Loading banks...' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
