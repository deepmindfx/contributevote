
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useEffect, useRef, useState } from "react";
import { getReservedAccountTransactions } from "@/services/walletIntegration";
import { ActivityList } from "./activity";

const RecentActivity = () => {
  const { user } = useSupabaseUser();
  const [isLoading, setIsLoading] = useState(false);
  
  // TODO: Implement with Supabase transactions
  useEffect(() => {
    // Will fetch recent activity from Supabase
    setIsLoading(false);
  }, [user]);

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
