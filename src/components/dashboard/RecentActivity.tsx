
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Vote } from "lucide-react";
import { Link } from "react-router-dom";

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
            <ArrowDown size={18} />
          </div>
        );
      case "withdrawal":
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ArrowUp size={18} />
          </div>
        );
      case "vote":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Vote size={18} />
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
  const activities = [
    {
      type: "deposit" as const,
      title: "Monthly Contribution",
      description: "Wedding Fund",
      amount: "+₦ 50,000",
      date: "Today, 10:45 AM",
      status: "completed" as const
    },
    {
      type: "vote" as const,
      title: "Vote Request",
      description: "Business Launch - Rent Payment",
      amount: "₦ 120,000",
      date: "Yesterday",
      status: "pending" as const
    },
    {
      type: "withdrawal" as const,
      title: "Fund Withdrawal",
      description: "Family Vacation",
      amount: "-₦ 35,000",
      date: "Jun 23, 2023",
      status: "completed" as const
    },
    {
      type: "vote" as const,
      title: "Vote Result",
      description: "Wedding Fund - Venue Booking",
      amount: "₦ 250,000",
      date: "Jun 20, 2023",
      status: "rejected" as const
    }
  ];

  return (
    <Card className="glass-card animate-slide-up animation-delay-400">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">Recent Activity</CardTitle>
          <Link to="/activity" className="text-sm text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {activities.map((activity, index) => (
            <ActivityItem key={index} {...activity} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
