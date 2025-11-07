import { ReactNode } from 'react';
import { useVotingRights } from '@/hooks/useVotingRights';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock, CreditCard, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContributeButton } from './ContributeButton';

interface VotingRightsGuardProps {
  groupId: string;
  groupName: string;
  children: ReactNode;
  fallback?: ReactNode;
  onContributeSuccess?: () => void;
}

export function VotingRightsGuard({
  groupId,
  groupName,
  children,
  fallback,
  onContributeSuccess,
}: VotingRightsGuardProps) {
  const { canVote, loading, isAdmin, refresh } = useVotingRights(groupId);

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (canVote) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card className="p-6">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900 p-4">
            <Lock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Voting Rights Required</h3>
          <p className="text-muted-foreground">
            You need to contribute to this group to access this feature.
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>How to get voting rights</AlertTitle>
          <AlertDescription className="mt-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Contribute via card or bank payment (instant voting rights)</li>
              <li>Transfer to group account number (requires admin verification)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <ContributeButton
            groupId={groupId}
            groupName={groupName}
            onSuccess={() => {
              refresh();
              onContributeSuccess?.();
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Contributing helps support the group and grants you voting rights
        </p>
      </div>
    </Card>
  );
}
