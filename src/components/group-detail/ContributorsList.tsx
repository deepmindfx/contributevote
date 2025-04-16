
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ContributorsListProps {
  contributors: {
    userId: string;
    name: string;
    email?: string;
    amount: number;
    date: string;
    anonymous?: boolean;
  }[];
}

const ContributorsList = ({ contributors }: ContributorsListProps) => {
  const { refreshData } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Group contributions by user (handling anonymous separately)
  const groupedContributors = contributors.reduce((acc, contributor) => {
    const key = contributor.anonymous 
      ? `anonymous-${contributor.userId || 'unknown'}`
      : contributor.userId || contributor.email || 'unknown';
    
    if (!acc[key]) {
      acc[key] = {
        ...contributor,
        totalAmount: contributor.amount,
        contributions: 1,
        lastContribution: contributor.date,
      };
    } else {
      acc[key].totalAmount += contributor.amount;
      acc[key].contributions += 1;
      
      // Keep the most recent contribution date
      const currentDate = new Date(acc[key].lastContribution);
      const newDate = new Date(contributor.date);
      if (newDate > currentDate) {
        acc[key].lastContribution = contributor.date;
      }
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  // Convert back to array and sort by total contribution amount
  const sortedContributors = Object.values(groupedContributors)
    .sort((a, b) => b.totalAmount - a.totalAmount);
  
  // Calculate total contributed amount
  const totalContributed = sortedContributors.reduce(
    (sum, contributor) => sum + contributor.totalAmount, 0
  );
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await refreshData();
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error("Error refreshing data:", error);
      setIsRefreshing(false);
    }
  };
  
  // Format date utility function
  const formatContributionDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      return "Unknown date";
    }
  };
  
  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contributors</CardTitle>
          <CardDescription>
            {sortedContributors.length} contributor{sortedContributors.length !== 1 ? 's' : ''} · 
            ₦{totalContributed.toLocaleString()} total
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className={isRefreshing ? "animate-spin" : ""}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="sr-only">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {sortedContributors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No contributions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedContributors.map((contributor, index) => {
              // Calculate percentage of total
              const contributionPercentage = Math.round(
                (contributor.totalAmount / totalContributed) * 100
              );
              
              // Generate initials for avatar
              const getInitials = () => {
                if (contributor.anonymous) return "A";
                if (!contributor.name) return "?";
                
                return contributor.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2);
              };
              
              return (
                <div key={index} className="flex items-start space-x-4">
                  <Avatar className="h-10 w-10 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-medium leading-none">
                          {contributor.anonymous ? "Anonymous" : contributor.name || "Unknown User"}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {contributor.contributions > 1 
                            ? `${contributor.contributions} contributions` 
                            : '1 contribution'} · 
                          Last on {formatContributionDate(contributor.lastContribution)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          ₦{contributor.totalAmount.toLocaleString()}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {contributionPercentage}% of total
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={contributionPercentage} 
                      className="h-1.5" 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContributorsList;
