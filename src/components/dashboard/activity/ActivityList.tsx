import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { format, isValid } from "date-fns";
import { useMemo } from "react";
import ActivityItem from "./ActivityItem";
import EmptyActivity from "./EmptyActivity";
import ActivitySkeleton from "./ActivitySkeleton";

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
        
        let type: "deposit" | "withdrawal" | "vote" = "deposit";
        if (transaction.type === "withdrawal") type = "withdrawal";
        if (transaction.type === "vote") type = "vote";
        
        return {
          type,
          title: transaction.type === 'deposit' ? 'Deposit' : 
                 transaction.type === 'withdrawal' ? 'Withdrawal' : 
                 transaction.type === 'contribution' ? 'Group Contribution' : 'Vote',
          description: contribution ? contribution.name : 
                       transaction.description || 
                       (meta?.bankName ? `Via ${meta.bankName}` : ''),
          amount: transaction.type === 'vote' ? 
                  `₦${transaction.amount.toLocaleString()}` : 
                  `${transaction.type === 'deposit' || transaction.type === 'contribution' ? '+' : '-'}₦${transaction.amount.toLocaleString()}`,
          date: formatDate(transaction.created_at),
          status: transaction.status as "pending" | "completed" | "rejected",
          senderDetails: getSenderDetails(transaction),
          id: transaction.id, // Add ID for better key handling
          reference: meta?.paymentReference || meta?.transactionReference, // Add reference for better key handling
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

  // Enhanced function to get sender details from transaction
  function getSenderDetails(transaction: any) {
    if (transaction.type !== 'deposit' && transaction.type !== 'contribution') return null;
    
    const meta = (transaction.metadata || {}) as any;
    const senderName = meta?.senderName || 
                      meta?.contributorName || 
                      meta?.customerName;
                      
    const bankName = meta?.bankName || 
                    meta?.senderBank || 
                    meta?.paymentBank;
    
    if (senderName && bankName) {
      return `From: ${senderName} (${bankName})`;
    } else if (senderName) {
      return `From: ${senderName}`;
    } else if (bankName) {
      return `Via: ${bankName}`;
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
