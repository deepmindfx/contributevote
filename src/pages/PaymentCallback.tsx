import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EdgeFunctionService } from '@/services/supabase/edgeFunctionService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import BrandLoader from '@/components/ui/BrandLoader';
import { toast } from 'sonner';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const [isVerifying, setIsVerifying] = useState(true);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

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
          await Promise.all([refreshCurrentUser(), refreshContributionData(true)]);
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

    void verifyPayment();
  }, [searchParams, navigate, refreshCurrentUser, refreshContributionData]);

  return (
    <BrandLoader
      variant="fullscreen"
      message={isVerifying ? 'Verifying your payment' : 'Payment confirmed'}
      submessage={
        isVerifying
          ? 'Please hold on while we securely confirm your transaction…'
          : 'Redirecting you back to CollectiPay…'
      }
    />
  );
};

export default PaymentCallback;
