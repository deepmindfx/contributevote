import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Contribution, WithdrawalRequest, Transaction, hasContributed } from "@/services/localStorage";
import { ensureAccountNumberDisplay } from "@/localStorage";
import { toast } from "sonner";

export function useContributionDetail(id: string | undefined) {
  const navigate = useNavigate();
  const {
    contributions,
    withdrawalRequests,
    transactions,
    user,
    refreshData,
  } = useApp();
  
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributionRequests, setContributionRequests] = useState<WithdrawalRequest[]>([]);
  const [hasUserContributed, setHasUserContributed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filter and deduplicate transactions
  const contributionTransactions = useMemo(() => {
    if (!id || !transactions) return [];

    const groupTransactions = transactions.filter(t => t.contributionId === id);
    const uniqueTransactions = new Map();

    // Keep only unique transactions based on payment reference or transaction ID
    groupTransactions.forEach(transaction => {
      const key = transaction.metaData?.paymentReference || 
                 transaction.metaData?.paymentDetails?.transactionId ||
                 transaction.id;
      
      // Only keep the first occurrence of each transaction
      if (!uniqueTransactions.has(key)) {
        uniqueTransactions.set(key, transaction);
      }
    });

    return Array.from(uniqueTransactions.values());
  }, [id, transactions]);

  useEffect(() => {
    // Refresh data when component mounts to ensure fresh data after login
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Add defensive check for contributions array
      if (!contributions || contributions.length === 0) {
        // If no contributions yet (possibly still loading), don't show error toast
        return;
      }
      
      const foundContribution = contributions.find(c => c.id === id);
      if (!foundContribution) {
        toast.error("Contribution group not found");
        navigate("/dashboard");
        return;
      }
      
      // Call the function to ensure account numbers exist
      ensureAccountNumberDisplay();
      
      // Set contribution and withdrawal requests
      setContribution(foundContribution);
      setContributionRequests(withdrawalRequests.filter(w => w.contributionId === id));

      // Check if user has contributed to this group
      if (user && user.id) {
        setHasUserContributed(hasContributed(user.id, id));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading contribution details:", error);
      setIsLoading(false);
    }
  }, [id, contributions, withdrawalRequests, navigate, user]);

  return {
    contribution,
    contributionRequests,
    contributionTransactions,
    hasUserContributed,
    isLoading,
  };
}
