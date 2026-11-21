
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
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Recent activity</CardTitle>
          <Link to="/activity" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <ActivityList isLoading={isLoading} />
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
