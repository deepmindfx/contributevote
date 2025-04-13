
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useEffect, useRef, useState } from "react";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { ActivityList } from "./activity";

const RecentActivity = () => {
  const { user, refreshData } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const hasInitiallyFetched = useRef(false);
  
  // Fetch transactions only once when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (user?.reservedAccount?.accountReference && !hasInitiallyFetched.current) {
        setIsLoading(true);
        try {
          await getReservedAccountTransactions(user.reservedAccount.accountReference);
          refreshData();
          hasInitiallyFetched.current = true;
        } catch (error) {
          console.error("Error fetching transactions:", error);
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
        <ActivityList isLoading={isLoading} />
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
