import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ChevronDown, Info, ArrowLeft, Lock, Search, Loader2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import html2canvas from 'html2canvas';

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
  const { user, refreshData } = useApp();
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
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
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

  // Update the account validation function
  const validateAccount = async (bankCode: string, accountNumber: string) => {
    setIsValidatingAccount(true);
    setAccountError(null);
    try {
      const response = await fetch(`/api/resolve-account?bankCode=${bankCode}&accountNumber=${accountNumber}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to validate account');
      }
      
      return data.data;
    } catch (error: any) {
      console.error('Account validation error:', error);
      setAccountError(error.message || 'Failed to validate account. Please try again.');
      throw error;
    } finally {
      setIsValidatingAccount(false);
    }
  };

  // Update the account number effect
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

  const generateReceipt = async () => {
    setIsGeneratingReceipt(true);
    try {
      const receiptElement = document.getElementById('transfer-receipt');
      if (!receiptElement) return;

      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `transfer-receipt-${new Date().getTime()}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // Add function to save transaction to history
  const saveTransactionToHistory = (transaction: Transaction) => {
    const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    console.log('Existing transactions:', existingTransactions);
    
    const newTransaction = {
      ...transaction,
      type: 'transfer',
      userId: user?.id || '',
      contributionId: '',
      description: `Transfer to ${transaction.recipientName} (${transaction.recipientAccount})`,
      paymentMethod: 'bank_transfer',
      createdAt: transaction.createdAt,
      updatedAt: new Date().toISOString(),
      metaData: {
        senderName: user?.firstName + ' ' + user?.lastName,
        bankName: transaction.bankName,
        narration: transaction.narration || '',
        transactionReference: transaction.reference,
        paymentReference: transaction.reference
      }
    };
    console.log('New transaction to be saved:', newTransaction);
    
    const updatedTransactions = [newTransaction, ...existingTransactions];
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
    
    // Verify the save
    const savedTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    console.log('Updated transactions in localStorage:', savedTransactions);
  };

  // Update handleConfirmTransfer
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
      // First validate the account again before transfer
      const accountData = await validateAccount(transferData.bankCode, transferData.accountNumber);
      
      // Proceed with transfer
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transferData,
          currency: 'NGN',
          beneficiaryName: accountData.account_name
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Transfer failed');
      }

      if (result.status === 'success' && result.data) {
        // Save transaction to history
        const transaction: Transaction = {
          id: result.data.id.toString(),
          reference: result.data.reference,
          amount: result.data.amount,
          fee: result.data.fee,
          status: result.data.status,
          createdAt: result.data.created_at,
          recipientName: result.data.full_name,
          recipientAccount: result.data.account_number,
          bankName: result.data.bank_name,
          narration: result.data.narration || transferData.narration
        };
        saveTransactionToHistory(transaction);

        // Show success message
        toast.success(result.message || 'Transfer initiated successfully');

        // Navigate to wallet history
        navigate('/wallet-history');
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
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center p-4 border-b">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Transfer Receipt</h1>
        </div>
        
        <div className="flex-1 p-4 overflow-auto max-w-md mx-auto w-full">
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Transfer Receipt</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={generateReceipt}
                disabled={isGeneratingReceipt}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGeneratingReceipt ? 'Generating...' : 'Download Receipt'}
              </Button>
            </div>
            
            <div id="transfer-receipt" className="p-6 border rounded-lg bg-white">
              {/* Receipt Header */}
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Transfer Receipt</h2>
                <p className="text-sm text-gray-500 mt-1">Transaction {transferReceipt.status}</p>
              </div>

              {/* Transaction Details */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-medium">{transferReceipt.id}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Reference</span>
                  <span className="font-medium">{transferReceipt.reference}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Date & Time</span>
                  <span className="font-medium">{new Date(transferReceipt.created_at).toLocaleString('en-NG')}</span>
                </div>
              </div>

              {/* Sender Details */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Sender Details</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-gray-600">{user?.accountNumber}</p>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Recipient Details</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{transferReceipt.full_name}</p>
                  <p className="text-sm text-gray-600">{transferReceipt.account_number}</p>
                  <p className="text-sm text-gray-600">{transferReceipt.bank_name}</p>
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium text-[#2DAE75]">{formatCurrency(transferReceipt.amount)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Fee</span>
                  <span className="font-medium">₦ {transferReceipt.fee?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">Total</span>
                  <span className="font-medium">₦ {(transferReceipt.amount + (transferReceipt.fee || 0)).toFixed(2)}</span>
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  transferReceipt.status === 'SUCCESSFUL' ? 'bg-green-100 text-green-800' :
                  transferReceipt.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {transferReceipt.status}
                </span>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Thank you for using our service</p>
                <p className="mt-1">This is a computer-generated receipt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <div className="text-right">
                  <span className="font-medium block">{user?.firstName} {user?.lastName}</span>
                  <span className="text-sm text-gray-500">{user?.accountNumber}</span>
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
              <div className="flex justify-between">
                <span className="text-gray-500">Fee</span>
                <span className="font-medium">₦ {transferReceipt?.fee?.toFixed(2) || '0.00'}</span>
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
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    type="password"
                    maxLength={1}
                    className="w-14 h-14 text-center text-xl border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                    value={transactionPin[index] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 1) {
                        const newPin = transactionPin.split('');
                        newPin[index] = value;
                        setTransactionPin(newPin.join(''));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !transactionPin[index] && index > 0) {
                        const newPin = transactionPin.split('');
                        newPin[index - 1] = '';
                        setTransactionPin(newPin.join(''));
                        const prevInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (prevInput) prevInput.focus();
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-auto space-y-4">
            <Button
              className="w-full py-3 bg-[#2DAE75] hover:bg-[#249e69] text-white font-medium"
              onClick={handleConfirmTransfer}
              disabled={isLoading || isValidating || transactionPin.length < 4}
            >
              {isLoading ? 'Processing...' : isValidating ? 'Validating...' : 'Confirm'}
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
                    placeholder={isLoadingBanks ? "Loading banks..." : "Search banks..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowBankList(true);
                    }}
                    onFocus={() => setShowBankList(true)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
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
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
                  >
                    {filteredBanks.length === 0 ? (
                      <div className="p-3 text-center text-gray-500">No banks found</div>
                    ) : (
                      filteredBanks.map((bank) => (
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
              <div className="relative">
                <input
                  type="text"
                  {...register('beneficiaryName', {
                    required: 'Beneficiary name is required'
                  })}
                  readOnly
                  className={`w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent ${
                    accountError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                  }`}
                  placeholder={isValidatingAccount ? "Verifying account..." : "Will be auto-filled"}
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
