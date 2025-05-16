import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Contribution, WithdrawalRequest, Transaction, hasContributed } from "@/services/localStorage";
import { ensureAccountNumberDisplay } from "@/localStorage";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
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
  const [contributionTransactions, setContributionTransactions] = useState<Transaction[]>([]);
  const [hasUserContributed, setHasUserContributed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTransactionCheck, setLastTransactionCheck] = useState(0);

  // Function to check if there are new transactions for this contribution
  const checkForNewTransactions = async (contributionData: Contribution) => {
    // Only check for transactions once every 30 seconds to avoid overwhelming the API
    const now = Date.now();
    if (now - lastTransactionCheck < 30000) {
      console.log("Skipping transaction check - checked recently");
      return;
    }
    
    if (contributionData && contributionData.accountReference) {
      console.log(`Checking for new transactions for ${contributionData.name} with account reference ${contributionData.accountReference}`);
      try {
        await getReservedAccountTransactions(contributionData.accountReference);
        // Mark the time of this check
        setLastTransactionCheck(now);
        // DO NOT call refreshData() here - it creates an infinite loop
      } catch (error) {
        console.error("Error checking for new transactions:", error);
      }
    } else {
      console.log("No account reference available, skipping transaction check");
    }
  };

  // Set up regular polling for new transactions and updates
  useEffect(() => {
    // Refresh data when component mounts to ensure fresh data
    refreshData();
    
    // Set up a polling interval for regular data refresh - use a longer interval
    const intervalId = setInterval(() => {
      console.log('Polling for contribution updates...');
      refreshData();
    }, 60000); // 60 seconds - reduced from 15 seconds to avoid overwhelming the app

    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove the dependency on contribution.id
  
  // Separate effect for checking transactions occasionally
  useEffect(() => {
    if (contribution) {
      const transactionIntervalId = setInterval(() => {
        checkForNewTransactions(contribution);
      }, 30000); // Check every 30 seconds
      
      return () => {
        clearInterval(transactionIntervalId);
      };
    }
  }, [contribution]);
  
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
      
      // Set contribution and other related data
      setContribution(foundContribution);
      setContributionRequests(withdrawalRequests.filter(w => w.contributionId === id));
      setContributionTransactions(transactions.filter(t => t.contributionId === id));

      // Check for new transactions only on initial load - skip it during re-renders
      if (isLoading) {
        // Use a short timeout to avoid immediate API call that might cause refresh issues
        setTimeout(() => {
          checkForNewTransactions(foundContribution);
        }, 2000);
      }

      // Check if user has contributed to this group
      if (user && user.id) {
        setHasUserContributed(hasContributed(user.id, id));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading contribution details:", error);
      setIsLoading(false);
    }
  }, [id, contributions, withdrawalRequests, transactions, navigate, user]);

  return {
    contribution,
    contributionRequests,
    contributionTransactions,
    hasUserContributed,
    isLoading,
  };
}
