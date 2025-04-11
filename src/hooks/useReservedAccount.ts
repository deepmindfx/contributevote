
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ReservedAccountData } from '@/services/wallet/types';
import { 
  createReservedAccount, 
  getReservedAccount 
} from '@/services/wallet';

export function useReservedAccount() {
  const { user, refreshData } = useApp();
  const [reservedAccount, setReservedAccount] = useState<ReservedAccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the user's reserved account, if they have one
  useEffect(() => {
    if (user?.reservedAccount) {
      setReservedAccount(user.reservedAccount);
    } else {
      setReservedAccount(null);
    }
  }, [user?.reservedAccount]);

  // Function to create a reserved account
  const createAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      const newReservedAccount = await createReservedAccount();
      setReservedAccount(newReservedAccount);
      refreshData(); // Update the app context with the new user data
      return newReservedAccount;
    } catch (err) {
      console.error('Error creating reserved account:', err);
      setError('Failed to create reserved account. Please try again later.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    reservedAccount,
    loading,
    error,
    createAccount,
    hasReservedAccount: !!reservedAccount
  };
}

export default useReservedAccount;
