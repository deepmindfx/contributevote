import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingBankTransfers } from './PendingBankTransfers';
import { ContributorsList } from './ContributorsList';
import { WithdrawalRequest } from '@/components/contribution/WithdrawalRequest';
import { Shield, Users, AlertCircle, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GroupAdminPanelProps {
  groupId: string;
  isAdmin: boolean;
}

export function GroupAdminPanel({ groupId, isAdmin }: GroupAdminPanelProps) {
  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Admin Panel</h2>
            <p className="text-sm text-muted-foreground">
              Manage contributors and verify bank transfers
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            As an admin, you can verify bank transfers and grant voting rights to contributors.
            Card/bank payments through the app automatically grant voting rights.
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              <AlertCircle className="h-4 w-4 mr-2" />
              Pending Transfers
            </TabsTrigger>
            <TabsTrigger value="withdrawal">
              <Wallet className="h-4 w-4 mr-2" />
              Withdrawal
            </TabsTrigger>
            <TabsTrigger value="contributors">
              <Users className="h-4 w-4 mr-2" />
              All Contributors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <PendingBankTransfers groupId={groupId} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="withdrawal" className="mt-6">
            <WithdrawalRequest groupId={groupId} />
          </TabsContent>

          <TabsContent value="contributors" className="mt-6">
            <ContributorsList groupId={groupId} />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
