
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ChevronDown, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TransferFormData>();

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/banks');
        const data = await response.json();
        setBanks(data.data);
      } catch (error) {
        toast.error('Failed to fetch banks');
      } finally {
        setIsLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

  const onSubmit = async (data: TransferFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          currency: 'NGN'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      toast.success('Transfer initiated successfully');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate transfer');
    } finally {
      setIsLoading(false);
    }
  };

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
      
      <div className="flex-1 p-4 overflow-auto max-w-md mx-auto w-full">
        {/* Daily Transaction Limit Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center">
          <Info className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-amber-800">Maximum account transaction limit: ₦500,000.00 daily</span>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <div className="relative">
              <select
                {...register('bankCode', { required: 'Bank is required' })}
                className="w-full p-3 pr-10 border border-gray-300 rounded-lg appearance-none bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
                defaultValue=""
              >
                <option value="" disabled>Select bank</option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5" />
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
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2DAE75] focus:border-transparent"
              placeholder="Enter beneficiary name"
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
  );
}
