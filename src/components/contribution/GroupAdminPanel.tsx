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
    <Card className="p-4 md:p-6">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0 mt-1" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-bold">Admin Panel</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage contributors and verify bank transfers
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="text-xs md:text-sm">
            As an admin, you can verify bank transfers and grant voting rights to contributors.
            Card/bank payments through the app automatically grant voting rights.
          </AlertDescription>
        </Alert>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="pending" className="text-xs md:text-sm px-2 py-2 md:px-3 md:py-2.5">
              <AlertCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Pending</span>
              <span className="sm:hidden">Pending</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawal" className="text-xs md:text-sm px-2 py-2 md:px-3 md:py-2.5">
              <Wallet className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Withdrawal</span>
              <span className="sm:hidden">Withdraw</span>
            </TabsTrigger>
            <TabsTrigger value="contributors" className="text-xs md:text-sm px-2 py-2 md:px-3 md:py-2.5">
              <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Contributors</span>
              <span className="sm:hidden">Members</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 md:mt-6">
            <PendingBankTransfers groupId={groupId} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="withdrawal" className="mt-4 md:mt-6">
            <WithdrawalRequest groupId={groupId} />
          </TabsContent>

          <TabsContent value="contributors" className="mt-4 md:mt-6">
            <ContributorsList groupId={groupId} />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
