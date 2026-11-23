import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BrandLoader from '@/components/ui/BrandLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WalletFlow } from '@/components/wallet/WalletFlow';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { EdgeFunctionService } from '@/services/supabase/edgeFunctionService';

function groupReturnPath(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value) ? `/groups/${value}` : null;
}

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const transactionId = params.get('transaction_id');
  const reference = params.get('tx_ref') || undefined;
  const returnPath = groupReturnPath(params.get('group'));
  const canVerify = /^\d{1,20}$/.test(transactionId ?? '');
  const cancelled = !canVerify && ['canceled', 'cancelled', 'failed'].includes(params.get('status')?.toLowerCase() ?? '');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const verification = useRef<{ key: string; request: ReturnType<typeof EdgeFunctionService.verifyTransaction> }>();

  useEffect(() => {
    if (!canVerify || !transactionId) return;
    const key = JSON.stringify([transactionId, reference, attempt]);
    if (verification.current?.key !== key) {
      verification.current = { key, request: EdgeFunctionService.verifyTransaction({ transaction_id: transactionId, tx_ref: reference }) };
    }
    let active = true;
    void verification.current.request.then((result) => {
      if (!active) return;
      if (!result?.success) {
        setError(result?.error || 'Flutterwave hasn’t confirmed this payment yet.');
        return;
      }
      const groupPath = groupReturnPath(result.data?.contributionId);
      void Promise.allSettled([refreshCurrentUser(), refreshContributionData(true)]);
      toast.success(groupPath ? 'Contribution verified and credited' : 'Payment verified and credited to your wallet');
      navigate(groupPath || '/dashboard', { replace: true });
    }, () => {
      if (active) setError('We couldn’t reach Flutterwave to confirm your payment. Try verifying again.');
    });
    return () => { active = false; };
  }, [attempt, canVerify, transactionId, reference, navigate, refreshCurrentUser, refreshContributionData]);

  if (canVerify && !error) {
    return <BrandLoader variant="fullscreen" message="Verifying your payment" submessage="We’re checking the payment securely with Flutterwave." />;
  }

  return (
    <WalletFlow title={cancelled ? 'Payment not completed' : 'Payment verification'}>
      <Card className="space-y-4 rounded-2xl p-5">
        <p role="status" className="text-sm text-muted-foreground">
          {cancelled ? 'Checkout ended before the payment could be confirmed.'
            : error || 'The return link is missing payment details. Check Wallet History for your payment status.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {canVerify && <Button onClick={() => { setError(''); setAttempt((current) => current + 1); }}>Retry verification</Button>}
          <Button variant={canVerify ? 'outline' : 'default'} asChild>
            <Link to={returnPath || '/wallet-history'}>{returnPath ? 'Back to group' : 'Open Wallet History'}</Link>
          </Button>
        </div>
      </Card>
    </WalletFlow>
  );
}
