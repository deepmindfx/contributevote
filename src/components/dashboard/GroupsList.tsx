import { Link } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import CategoryIcon from "@/components/ui/CategoryIcon";

const naira = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

export default function GroupsList() {
  const { contributions, loading } = useSupabaseContribution();
  const groups = contributions.filter((group) => !group.archived).slice(0, 3);

  return (
    <>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
        <h2 id="groups-heading" className="app-section-title">My groups</h2>
        <Button asChild variant="ghost" className="gap-1 text-primary">
          <Link to="/all-groups">View all <ChevronRight size={16} aria-hidden="true" /></Link>
        </Button>
      </div>
      <Card className="overflow-hidden rounded-[1.35rem]">
        {loading ? (
          <div className="space-y-4 p-5" role="status" aria-label="Loading groups">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-9 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary">
              <Users size={21} aria-hidden="true" />
            </span>
            <h3 className="font-semibold">No groups yet</h3>
            <p className="max-w-60 text-sm text-muted-foreground">Start a group for something you’re saving toward together.</p>
            <Button asChild variant="outline"><Link to="/create-group">Create a group</Link></Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {groups.map((group) => {
              const raised = group.current_amount ?? 0;
              const target = group.target_amount ?? 0;
              const progress = target > 0 ? Math.min(100, Math.max(0, Math.round(raised / target * 100))) : 0;
              const members = group.contributors?.length ?? 0;

              return (
                <li key={group.id}>
                  <Link to={`/groups/${group.id}`} className="block p-4 transition-colors hover:bg-muted/45 focus-visible:bg-muted focus-visible:outline-none sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-primary" aria-hidden="true">
                        <CategoryIcon category={group.category} size={19} />
                        {group.cover_image_url && (
                          <img key={group.cover_image_url} src={group.cover_image_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover"
                            onError={(event) => { event.currentTarget.hidden = true; }} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">{group.name}</h3>
                        <p className="text-xs text-muted-foreground">{members} {members === 1 ? "member" : "members"}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <Progress className="mb-2 mt-4 h-1.5" value={progress} aria-label={`${group.name} funding progress`} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
                      <span className="font-semibold">₦{naira.format(raised)} <span className="font-normal text-muted-foreground">of ₦{naira.format(target)}</span></span>
                      <span className="text-xs font-medium text-primary">{progress}% funded</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
