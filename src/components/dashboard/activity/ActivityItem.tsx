
import { 
  VoteIcon,
  Wallet,
  PiggyBank
} from "lucide-react";

export interface ActivityItemProps {
  type: "deposit" | "withdrawal" | "vote";
  title: string;
  description: string;
  amount: string;
  date: string;
  status?: "pending" | "completed" | "rejected";
  senderDetails?: string;
}

const ActivityItem = ({ type, title, description, amount, date, status, senderDetails }: ActivityItemProps) => {
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
            {senderDetails && <p className="text-xs text-muted-foreground mt-0.5">{senderDetails}</p>}
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

export default ActivityItem;
