import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contribution, WithdrawalRequest, Transaction } from "@/services/localStorage";

// Import the components
import GroupWallet from "@/components/group-detail/GroupWallet";
import WithdrawalRequests from "@/components/group-detail/WithdrawalRequests";
import ContributorsList from "@/components/group-detail/ContributorsList";
import TransactionsList from "@/components/group-detail/TransactionsList";
interface GroupDetailContentProps {
  contribution: Contribution;
  contributionRequests: WithdrawalRequest[];
  contributionTransactions: Transaction[];
  hasUserContributed: boolean;
  isUserCreator: boolean;
  contributionAmount: string;
  setContributionAmount: React.Dispatch<React.SetStateAction<string>>;
  withdrawalAmount: string;
  setWithdrawalAmount: React.Dispatch<React.SetStateAction<string>>;
  withdrawalPurpose: string;
  setWithdrawalPurpose: React.Dispatch<React.SetStateAction<string>>;
  anonymous: boolean;
  setAnonymous: React.Dispatch<React.SetStateAction<boolean>>;
  handleContribute: () => void;
  handleRequestWithdrawal: () => void;
}
const GroupDetailContent = ({
  contribution,
  contributionRequests,
  contributionTransactions,
  hasUserContributed,
  isUserCreator,
  contributionAmount,
  setContributionAmount,
  withdrawalAmount,
  setWithdrawalAmount,
  withdrawalPurpose,
  setWithdrawalPurpose,
  anonymous,
  setAnonymous,
  handleContribute,
  handleRequestWithdrawal
}: GroupDetailContentProps) => {
  return <div className="space-y-6">
      {/* Group Wallet Card */}
      <GroupWallet contribution={contribution} isUserCreator={isUserCreator} contributionAmount={contributionAmount} setContributionAmount={setContributionAmount} withdrawalAmount={withdrawalAmount} setWithdrawalAmount={setWithdrawalAmount} withdrawalPurpose={withdrawalPurpose} setWithdrawalPurpose={setWithdrawalPurpose} anonymous={anonymous} setAnonymous={setAnonymous} handleContribute={handleContribute} handleRequestWithdrawal={handleRequestWithdrawal} />
      
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Tabs defaultValue="withdrawals" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="withdrawals" className="text-sm">Withdrawal</TabsTrigger>
            <TabsTrigger value="contributors">Contributors</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
          
          {/* Withdrawal Requests Tab */}
          <TabsContent value="withdrawals">
            <WithdrawalRequests contribution={contribution} contributionRequests={contributionRequests} hasUserContributed={hasUserContributed} />
          </TabsContent>
          
          {/* Contributors Tab */}
          <TabsContent value="contributors">
            <ContributorsList contributors={contribution.contributors || []} />
          </TabsContent>
          
          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <TransactionsList transactions={contributionTransactions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};
export default GroupDetailContent;