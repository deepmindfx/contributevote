import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EdgeFunctionService } from '@/services/supabase/edgeFunctionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { toast } from 'sonner';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyPayment = async () => {
      const status = searchParams.get('status');
      const tx_ref = searchParams.get('tx_ref') || undefined;
      const transaction_id = searchParams.get('transaction_id');
      let targetGroupId: string | null = null;

      if (!transaction_id || (status && status !== 'successful' && status !== 'completed')) {
        toast.error('Payment was not completed');
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        const storedRaw = tx_ref ? localStorage.getItem(`flw_transaction_${tx_ref}`) : null;
        const storedDetails = storedRaw ? JSON.parse(storedRaw) : null;
        targetGroupId = storedDetails?.contribution_id || null;

        const result = await EdgeFunctionService.verifyTransaction({
          transaction_id,
          tx_ref,
          group_id: targetGroupId || undefined,
          anonymous: storedDetails?.anonymous,
        });

        if (result?.success) {
          targetGroupId = result.data?.contributionId || targetGroupId;
          if (tx_ref) {
            localStorage.removeItem(`flw_transaction_${tx_ref}`);
          }
          await Promise.all([refreshCurrentUser(), refreshContributionData()]);
          toast.success(
            targetGroupId
              ? 'Contribution verified and credited!'
              : 'Payment verified and wallet credited!'
          );
        } else {
          throw new Error(result?.error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast.error(error instanceof Error ? error.message : 'Payment verification failed');
      } finally {
        setIsVerifying(false);
        if (targetGroupId) {
          navigate(`/groups/${targetGroupId}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    };

    verifyPayment();
  }, [searchParams, navigate, refreshCurrentUser, refreshContributionData]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          {isVerifying ? 'Verifying Payment...' : 'Payment Complete'}
        </h2>
        <p className="text-muted-foreground">
          {isVerifying
            ? 'Please wait while we securely verify your payment'
            : 'Redirecting you back...'}
        </p>
      </div>
    </div>
  );
};

export default PaymentCallback;
