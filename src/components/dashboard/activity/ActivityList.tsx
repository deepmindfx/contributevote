import { useApp } from "@/contexts/AppContext";
import { format, isValid } from "date-fns";
import { useMemo } from "react";
import ActivityItem from "./ActivityItem";
import EmptyActivity from "./EmptyActivity";
import ActivitySkeleton from "./ActivitySkeleton";

interface ActivityListProps {
  isLoading: boolean;
}

const ActivityList = ({ isLoading }: ActivityListProps) => {
  const { transactions, contributions, user } = useApp();

  // Format and sort transactions, ensuring we only show unique transactions for the current user
  const formattedTransactions = useMemo(() => {
    // First, deduplicate transactions
    const seen = new Map();
    const uniqueTransactions = transactions
      .filter(transaction => transaction.userId === user?.id) // Only show current user's transactions
      .filter(transaction => transaction.createdAt) // Filter out transactions without createdAt
      .filter(transaction => {
        // Create a unique key based on multiple identifiers
        const key = transaction.metaData?.paymentReference || 
                   transaction.metaData?.paymentDetails?.transactionId ||
                   transaction.metaData?.transactionReference ||
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
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          
          if (!isValid(dateA) || !isValid(dateB)) {
            console.error("Invalid date in transaction sort:", a.createdAt, b.createdAt);
            return 0;
          }
          
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error("Error sorting transactions:", error);
          return 0;
        }
      })
      .slice(0, 5)
      .map(transaction => {
        const contribution = contributions.find(c => c.id === transaction.contributionId);
        
        let type: "deposit" | "withdrawal" | "vote" = "deposit";
        if (transaction.type === "withdrawal") type = "withdrawal";
        if (transaction.type === "vote") type = "vote";
        
        return {
          type,
          title: transaction.type === 'deposit' ? 'Contribution' : 
                 transaction.type === 'withdrawal' ? 'Fund Withdrawal' : 'Vote',
          description: contribution ? contribution.name : 
                       transaction.description || 
                       (transaction.metaData?.bankName ? `Via ${transaction.metaData.bankName}` : ''),
          amount: transaction.type === 'vote' ? 
                  `₦ ${transaction.amount.toLocaleString()}` : 
                  `${transaction.type === 'deposit' ? '+' : '-'}₦ ${transaction.amount.toLocaleString()}`,
          date: formatDate(transaction.createdAt),
          status: transaction.status as "pending" | "completed" | "rejected",
          senderDetails: getSenderDetails(transaction),
          id: transaction.id, // Add ID for better key handling
          reference: transaction.metaData?.paymentReference || transaction.metaData?.transactionReference, // Add reference for better key handling
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
    if (transaction.type !== 'deposit') return null;
    
    const senderName = transaction.metaData?.senderName || 
                      transaction.metaData?.contributorName || 
                      transaction.metaData?.customerName;
                      
    const bankName = transaction.metaData?.bankName || 
                    transaction.metaData?.senderBank || 
                    transaction.metaData?.paymentBank;
    
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
