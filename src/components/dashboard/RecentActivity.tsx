
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowDown, 
  ArrowUp, 
  Vote as VoteIcon,
  Wallet,
  MessageSquare,
  DollarSign,
  CreditCard,
  PiggyBank
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { format, isValid } from "date-fns";
import { useEffect, useState } from "react";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityItemProps {
  type: "deposit" | "withdrawal" | "vote";
  title: string;
  description: string;
  amount: string;
  date: string;
  status?: "pending" | "completed" | "rejected";
}

const ActivityItem = ({ type, title, description, amount, date, status }: ActivityItemProps) => {
  const getIcon = () => {
    switch (type) {
      case "deposit":
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
            <PiggyBank size={18} />
          </div>
        );
      case "withdrawal":
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Wallet size={18} />
          </div>
        );
      case "vote":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <VoteIcon size={18} />
          </div>
        );
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;
    
    switch (status) {
      case "pending":
        return (
          <div className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium">
            Pending
          </div>
        );
      case "completed":
        return (
          <div className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium">
            Completed
          </div>
        );
      case "rejected":
        return (
          <div className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium">
            Rejected
          </div>
        );
    }
  };

  return (
    <div className="flex items-start py-3 border-b last:border-b-0">
      {getIcon()}
      <div className="ml-3 flex-1">
        <div className="flex justify-between">
          <div>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="text-right">
            <div className={`font-medium ${type === "deposit" ? "text-green-500" : ""}`}>{amount}</div>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
        {status && (
          <div className="mt-2">
            {getStatusBadge()}
          </div>
        )}
      </div>
    </div>
  );
};

const RecentActivity = () => {
  const { transactions, contributions, user, refreshData } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch transactions when component mounts
  useEffect(() => {
    if (user?.reservedAccount?.accountReference) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          await getReservedAccountTransactions(user.reservedAccount.accountReference);
          refreshData();
        } catch (error) {
          console.error("Error fetching transactions:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchData();
    }
  }, [user?.reservedAccount, refreshData]);
  
  // Format and sort transactions
  const formattedTransactions = transactions
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

  return (
    <Card className="glass-card animate-slide-up animation-delay-400">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">Recent Activity</CardTitle>
          <Link to="/activity" className="text-sm text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start py-3 border-b last:border-b-0">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between">
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-2" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : formattedTransactions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No recent activities to display.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {formattedTransactions.map((activity, index) => (
              <ActivityItem key={index} {...activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
