import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import ActivityList from "./activity/ActivityList";

export default function RecentActivity() {
  const { transactionsLoading } = useSupabaseContribution();

  return (
    <>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
        <h2 id="activity-heading" className="app-section-title">Recent activity</h2>
        <Button asChild variant="ghost" className="gap-1 text-primary">
          <Link to="/activity">View all <ChevronRight size={16} aria-hidden="true" /></Link>
        </Button>
      </div>
      <Card className="rounded-[1.35rem]">
        <CardContent className="px-4 pb-1 sm:px-5">
          <ActivityList isLoading={transactionsLoading} />
        </CardContent>
      </Card>
    </>
  );
}
