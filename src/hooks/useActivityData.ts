
import { useApp } from "@/contexts/AppContext";
import { format, isValid } from "date-fns";

export const useActivityData = () => {
  const { transactions, contributions, user } = useApp();
  
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
  
  // Format and sort transactions, filtering to only show the current user's transactions
  const formattedTransactions = transactions
    .filter(transaction => transaction.userId === user?.id) // Only show current user's transactions
    .filter(transaction => transaction.createdAt) // Filter out transactions without createdAt
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
      }
    });
  
  return {
    formattedTransactions,
    formatDate
  };
};
