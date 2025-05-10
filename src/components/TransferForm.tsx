import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';

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
  // Mocked list of popular Nigerian banks
  const banks: Bank[] = [
    { code: '044', name: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond)' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank (FCMB)' },
    { code: '058', name: 'Guaranty Trust Bank (GTB)' },
    { code: '030', name: 'Heritage Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '232', name: 'Sterling Bank' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank for Africa (UBA)' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' },
  ];

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TransferFormData>();

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white rounded-2xl shadow-lg p-6 border border-green-100">
      <div>
        <label className="block text-sm font-medium text-[#2DAE75] mb-1">
          Amount (₦)
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-[#2DAE75] sm:text-sm font-bold">₦</span>
          </div>
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
            className="block w-full pl-7 pr-12 rounded-md border border-green-200 focus:border-[#2DAE75] focus:ring-[#2DAE75] sm:text-sm bg-green-50 text-green-900 placeholder:text-green-400"
            placeholder="0.00"
          />
        </div>
        {errors.amount && (
          <p className="mt-2 text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2DAE75] mb-1">
          Bank
        </label>
        <select
          {...register('bankCode', { required: 'Bank is required' })}
          className="mt-1 block w-full rounded-md border border-green-200 shadow-sm focus:border-[#2DAE75] focus:ring-[#2DAE75] sm:text-sm bg-green-50 text-green-900"
        >
          <option value="">Select a bank</option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
        {errors.bankCode && (
          <p className="mt-2 text-sm text-red-600">{errors.bankCode.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2DAE75] mb-1">
          Account Number
        </label>
        <input
          type="text"
          {...register('accountNumber', {
            required: 'Account number is required',
            pattern: {
              value: /^\d{10}$/,
              message: 'Account number must be 10 digits'
            }
          })}
          className="mt-1 block w-full rounded-md border border-green-200 shadow-sm focus:border-[#2DAE75] focus:ring-[#2DAE75] sm:text-sm bg-green-50 text-green-900 placeholder:text-green-400"
          placeholder="Enter account number"
        />
        {errors.accountNumber && (
          <p className="mt-2 text-sm text-red-600">{errors.accountNumber.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2DAE75] mb-1">
          Beneficiary Name
        </label>
        <input
          type="text"
          {...register('beneficiaryName', {
            required: 'Beneficiary name is required'
          })}
          className="mt-1 block w-full rounded-md border border-green-200 shadow-sm focus:border-[#2DAE75] focus:ring-[#2DAE75] sm:text-sm bg-green-50 text-green-900 placeholder:text-green-400"
          placeholder="Enter beneficiary name"
        />
        {errors.beneficiaryName && (
          <p className="mt-2 text-sm text-red-600">{errors.beneficiaryName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2DAE75] mb-1">
          Narration (Optional)
        </label>
        <input
          type="text"
          {...register('narration')}
          className="mt-1 block w-full rounded-md border border-green-200 shadow-sm focus:border-[#2DAE75] focus:ring-[#2DAE75] sm:text-sm bg-green-50 text-green-900 placeholder:text-green-400"
          placeholder="Enter transfer narration"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2DAE75] hover:bg-[#249e69] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2DAE75] disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Processing...' : 'Send Money'}
        </button>
      </div>
    </form>
  );
} 