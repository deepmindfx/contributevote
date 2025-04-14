
import { useParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import GroupHeader from "@/components/group-detail/GroupHeader";
import GroupDetailContent from "@/components/group-detail/GroupDetailContent";
import LoadingState from "@/components/group-detail/LoadingState";
import { useContributionDetail } from "@/hooks/use-contribution-detail";
import { useContributionActions } from "@/hooks/use-contribution-actions";

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  
  // Custom hooks to handle data and actions
  const {
    contribution,
    contributionRequests,
    contributionTransactions,
    hasUserContributed,
    isLoading,
  } = useContributionDetail(id);
  
  const {
    contributionAmount,
    setContributionAmount,
    withdrawalAmount,
    setWithdrawalAmount,
    withdrawalPurpose,
    setWithdrawalPurpose,
    anonymous,
    setAnonymous,
    handleContribute,
    handleRequestWithdrawal,
    isGroupCreator
  } = useContributionActions();
  
  // Check if we're still loading or no contribution found
  const loadingElement = (
    <LoadingState isLoading={isLoading} contribution={contribution} />
  );
  if (isLoading || !contribution) {
    return loadingElement;
  }
  
  // Derive some values needed for the components
  const isUserCreator = isGroupCreator(contribution.id);
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Group Header */}
        <GroupHeader contribution={contribution} />
        
        {/* Main Content */}
        <GroupDetailContent 
          contribution={contribution}
          contributionRequests={contributionRequests}
          contributionTransactions={contributionTransactions}
          hasUserContributed={hasUserContributed}
          isUserCreator={isUserCreator}
          contributionAmount={contributionAmount}
          setContributionAmount={setContributionAmount}
          withdrawalAmount={withdrawalAmount}
          setWithdrawalAmount={setWithdrawalAmount}
          withdrawalPurpose={withdrawalPurpose}
          setWithdrawalPurpose={setWithdrawalPurpose}
          anonymous={anonymous}
          setAnonymous={setAnonymous}
          handleContribute={() => handleContribute(contribution.id)}
          handleRequestWithdrawal={() => handleRequestWithdrawal(contribution.id, contribution.currentAmount)}
        />
      </main>
      
      <MobileNav />
    </div>
  );
};

export default GroupDetail;
