
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { Contribution, WithdrawalRequest, Transaction, hasContributed } from "@/services/localStorage";
import { ensureAccountNumberDisplay } from "@/localStorage";

// Import the new components
import GroupHeader from "@/components/group-detail/GroupHeader";
import GroupWallet from "@/components/group-detail/GroupWallet";
import WithdrawalRequests from "@/components/group-detail/WithdrawalRequests";
import ContributorsList from "@/components/group-detail/ContributorsList";
import TransactionsList from "@/components/group-detail/TransactionsList";

const GroupDetail = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    contributions,
    withdrawalRequests,
    transactions,
    user,
    contribute,
    requestWithdrawal,
    getShareLink,
    isGroupCreator,
  } = useApp();
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributionRequests, setContributionRequests] = useState<WithdrawalRequest[]>([]);
  const [contributionTransactions, setContributionTransactions] = useState<Transaction[]>([]);
  const [contributionAmount, setContributionAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalPurpose, setWithdrawalPurpose] = useState("");
  const [anonymous, setAnonymous] = useState(user.preferences?.anonymousContributions || false);
  const [hasUserContributed, setHasUserContributed] = useState(false);
  
  useEffect(() => {
    if (!id) return;
    const foundContribution = contributions.find(c => c.id === id);
    if (!foundContribution) {
      toast.error("Contribution group not found");
      navigate("/dashboard");
      return;
    }
    
    // Call the function to ensure account numbers exist
    ensureAccountNumberDisplay();
    
    // Debug: Log the contribution to check account name and details
    console.log("Current contribution:", foundContribution);
    
    // Set contribution and other related data
    setContribution(foundContribution);
    setContributionRequests(withdrawalRequests.filter(w => w.contributionId === id));
    setContributionTransactions(transactions.filter(t => t.contributionId === id));

    // Check if user has contributed to this group
    setHasUserContributed(hasContributed(user.id, id));
  }, [id, contributions, withdrawalRequests, transactions, navigate, user.id]);
  
  if (!contribution) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  const handleContribute = () => {
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    contribute(contribution.id, Number(contributionAmount), anonymous);
    setContributionAmount("");
    setHasUserContributed(true);
  };
  
  const handleRequestWithdrawal = () => {
    if (!withdrawalAmount || isNaN(Number(withdrawalAmount)) || Number(withdrawalAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (Number(withdrawalAmount) > contribution.currentAmount) {
      toast.error("Requested amount exceeds available funds");
      return;
    }
    if (!withdrawalPurpose.trim()) {
      toast.error("Please enter a purpose for the withdrawal");
      return;
    }
    requestWithdrawal({
      contributionId: contribution.id,
      amount: Number(withdrawalAmount),
      reason: withdrawalPurpose,
      beneficiary: user.name || "Group Creator",
      accountNumber: "0000000000", // Default value, would be replaced with user's account in real app
      bankName: "User's Bank", // Default value, would be replaced with user's bank in real app
      purpose: withdrawalPurpose
    });
    setWithdrawalAmount("");
    setWithdrawalPurpose("");
  };
  
  const isUserCreator = isGroupCreator(contribution.id);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Group Header */}
        <GroupHeader contribution={contribution} />
        
        {/* Group Wallet Card */}
        <GroupWallet 
          contribution={contribution}
          isUserCreator={isUserCreator}
          contributionAmount={contributionAmount}
          setContributionAmount={setContributionAmount}
          withdrawalAmount={withdrawalAmount}
          setWithdrawalAmount={setWithdrawalAmount}
          withdrawalPurpose={withdrawalPurpose}
          setWithdrawalPurpose={setWithdrawalPurpose}
          anonymous={anonymous}
          setAnonymous={setAnonymous}
          handleContribute={handleContribute}
          handleRequestWithdrawal={handleRequestWithdrawal}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <Tabs defaultValue="withdrawals" className="w-full">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
              <TabsTrigger value="contributors">Contributors</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>
            
            {/* Withdrawal Requests Tab */}
            <TabsContent value="withdrawals">
              <WithdrawalRequests 
                contribution={contribution}
                contributionRequests={contributionRequests}
                hasUserContributed={hasUserContributed}
              />
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
      </main>
      
      <MobileNav />
    </div>
  );
};

export default GroupDetail;
