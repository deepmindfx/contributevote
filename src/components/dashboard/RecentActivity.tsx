
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useState, useRef } from "react";
import { getReservedAccountTransactions } from "@/services/wallet/reservedAccountService";
import { Skeleton } from "@/components/ui/skeleton";
import ActivityItem from "./activity/ActivityItem";
import { useActivityData } from "@/hooks/useActivityData";
import { toast } from "sonner";

const RecentActivity = () => {
  const { user, refreshData } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const hasInitiallyFetched = useRef(false);
  const { formattedTransactions } = useActivityData();
  
  // Fetch transactions only once when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (user?.reservedAccount?.accountReference && !hasInitiallyFetched.current) {
        setIsLoading(true);
        setHasError(false);
        try {
          await getReservedAccountTransactions(user.reservedAccount.accountReference);
          refreshData();
          hasInitiallyFetched.current = true;
        } catch (error) {
          console.error("Error fetching transactions:", error);
          setHasError(true);
          // Do not show error toast here as it will be too intrusive on dashboard
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
  }, [user?.reservedAccount, refreshData]);

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
        ) : hasError ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>Could not load transaction data.</p>
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
