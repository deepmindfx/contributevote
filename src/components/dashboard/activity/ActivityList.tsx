import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { format, isValid } from "date-fns";
import { useMemo } from "react";
import ActivityItem from "./ActivityItem";
import EmptyActivity from "./EmptyActivity";
import ActivitySkeleton from "./ActivitySkeleton";
import { getDepositSender, getTransferRecipient } from "@/utils/transactionDisplay";

interface ActivityListProps {
  isLoading: boolean;
}

const ActivityList = ({ isLoading }: ActivityListProps) => {
  const { user } = useSupabaseUser();
  const { transactions, contributions } = useSupabaseContribution();

  // Format and sort transactions, ensuring we only show unique transactions for the current user
  const formattedTransactions = useMemo(() => {
    // First, deduplicate transactions
    const seen = new Map();
    const uniqueTransactions = transactions
      .filter(transaction => transaction.user_id === user?.id) // Only show current user's transactions
      .filter(transaction => transaction.created_at) // Filter out transactions without created_at
      .filter(transaction => {
        const meta = (transaction.metadata || {}) as any;
        // Create a unique key based on multiple identifiers
        const key = meta?.paymentReference || 
                   meta?.paymentDetails?.transactionId ||
                   meta?.transactionReference ||
                   transaction.id;

        // If we've seen this key before, it's a duplicate
        if (seen.has(key)) {
          return false;
        }
        
        // Add the transaction to our seen map
        seen.set(key, true);
        return true;
      });

    // Then sort and format the unique transactions
    return uniqueTransactions
      .sort((a, b) => {
        try {
          const dateA = new Date(a.created_at);
          const dateB = new Date(b.created_at);
          
          if (!isValid(dateA) || !isValid(dateB)) {
            console.error("Invalid date in transaction sort:", a.created_at, b.created_at);
            return 0;
          }
          
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error("Error sorting transactions:", error);
          return 0;
        }
      })
      .slice(0, 3)
      .map(transaction => {
        const contribution = contributions.find(c => c.id === transaction.contribution_id);
        const meta = (transaction.metadata || {}) as any;
        const isCredit = transaction.type === "deposit" || transaction.type === "refund";
        
        let type: "deposit" | "withdrawal" | "vote" = "deposit";
        if (transaction.type === "withdrawal" || transaction.type === "transfer" || transaction.type === "contribution") {
          type = "withdrawal";
        }
        if (transaction.type === "vote") type = "vote";

        const titleMap: Record<string, string> = {
          deposit: "Wallet Deposit",
          withdrawal: "Withdrawal",
          contribution: "Group Contribution",
          transfer: "Bank Transfer",
          refund: "Group Refund",
          vote: "Governance Vote",
        };
        
        return {
          type,
          title: titleMap[transaction.type] || "Transaction",
          description: contribution ? contribution.name : 
                       transaction.description || 
                       (meta?.bankName || meta?.bank_name ? `Via ${meta.bankName || meta.bank_name}` : ''),
          amount: transaction.type === 'vote' ? 
                  `₦${Number(transaction.amount).toLocaleString()}` : 
                  `${isCredit ? '+' : '-'}₦${Number(transaction.amount).toLocaleString()}`,
          date: formatDate(transaction.created_at),
          status: transaction.status as "pending" | "completed" | "rejected" | "failed",
          senderDetails: getSenderDetails(transaction),
          id: transaction.id,
          reference: meta?.paymentReference || meta?.transactionReference,
        }
      });
  }, [transactions, contributions, user?.id]);

  function formatDate(dateString: string) {
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        console.error("Invalid date in formatDate:", dateString);
        return "Invalid date";
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return `Today, ${format(date, 'h:mm a')}`;
      } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  }

  // Enhanced function to get clean sender/recipient details from transaction
  function getSenderDetails(transaction: any) {
    const meta = (transaction.metadata || {}) as Record<string, unknown>;

    if (transaction.type === 'deposit' || transaction.type === 'contribution') {
      const { name, bankName } = getDepositSender(meta);
      if (name && bankName) return `From: ${name} (${bankName})`;
      if (name) return `From: ${name}`;
      if (bankName) return `Via: ${bankName}`;
      return null;
    }

    if (transaction.type === 'transfer' || transaction.type === 'withdrawal') {
      const { name, bankName } = getTransferRecipient(meta);
      if (name && bankName) return `To: ${name} (${bankName})`;
      if (name) return `To: ${name}`;
      if (bankName) return `To: ${bankName}`;
    }

    return null;
  }

  if (isLoading) {
    return <ActivitySkeleton />;
  }

  if (formattedTransactions.length === 0) {
    return <EmptyActivity />;
  }

  return (
    <div className="space-y-1">
      {formattedTransactions.map((activity) => (
        <ActivityItem 
          key={`${activity.id}-${activity.reference || ''}`} 
          {...activity} 
        />
      ))}
    </div>
  );
};

export default ActivityList;
