
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { contributeToGroup } from '@/services/localStorage';
import { toast } from 'sonner';
import axios from 'axios';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyPayment = async () => {
      const status = searchParams.get('status');
      const tx_ref = searchParams.get('tx_ref');
      const transaction_id = searchParams.get('transaction_id');

      if (!tx_ref || !transaction_id) {
        toast.error('Invalid payment response');
        navigate('/');
        return;
      }

      try {
        // Get stored transaction details
        const storedTransaction = localStorage.getItem(`flw_transaction_${tx_ref}`);
        if (!storedTransaction) {
          throw new Error('Transaction details not found');
        }

        const transactionDetails = JSON.parse(storedTransaction);

        // Verify transaction with Flutterwave
        const response = await axios.get(
          `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
          {
            headers: {
              Authorization: `Bearer ${process.env.VITE_FLUTTERWAVE_SECRET_KEY}`,
            },
          }
        );

        if (
          response.data.status === 'success' &&
          response.data.data.status === 'successful' &&
          response.data.data.amount === transactionDetails.amount &&
          response.data.data.currency === 'NGN'
        ) {
          // If this was a contribution, update the contribution amount
          if (transactionDetails.contribution_id) {
            try {
              contributeToGroup(
                transactionDetails.contribution_id,
                transactionDetails.amount,
                transactionDetails.anonymous || false
              );
              toast.success('Contribution successful!');
            } catch (err) {
              console.error('Error contributing to group:', err);
              toast.error('Failed to update contribution');
            }
          }

          // Clean up stored transaction
          localStorage.removeItem(`flw_transaction_${tx_ref}`);
        } else {
          throw new Error('Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast.error('Payment verification failed');
      } finally {
        setIsVerifying(false);
        // Redirect to appropriate page
        const storedTransaction = localStorage.getItem(`flw_transaction_${tx_ref}`);
        const transactionDetails = storedTransaction ? JSON.parse(storedTransaction) : null;
        
        if (transactionDetails?.contribution_id) {
          navigate(`/groups/${transactionDetails.contribution_id}`);
        } else {
          navigate('/wallet');
        }
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">
          {isVerifying ? 'Verifying Payment...' : 'Payment Complete'}
        </h2>
        <p className="text-muted-foreground">
          {isVerifying
            ? 'Please wait while we verify your payment'
            : 'Redirecting you back...'}
        </p>
      </div>
    </div>
  );
};

export default PaymentCallback; 
