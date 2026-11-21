import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import BrandLoader from "@/components/ui/BrandLoader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Compass,
  SlidersHorizontal,
  Globe,
  Lock,
} from "lucide-react";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { format, isValid, parseISO } from "date-fns";
import {
  getGroupsSorted,
  CATEGORIES,
  getCategoryLabel,
} from "@/services/supabase/groupEnhancementService";
import CategoryIcon from "@/components/ui/CategoryIcon";

const ITEMS_PER_PAGE = 9;

const AllGroups = () => {
  const { user } = useSupabaseUser();
  const { contributions } = useSupabaseContribution();
  const [sortBy, setSortBy] = useState<"date" | "category" | "progress">("date");
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortedContributions, setSortedContributions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setIsLoading(true);
    const useFallback = () => {
      setSortedContributions(contributions.filter((group) =>
        (showArchived || !group.archived) && (filterCategory === "all" || group.category === filterCategory),
      ));
      setIsLoading(false);
    };
    const timeout = window.setTimeout(useFallback, 10000);
    void getGroupsSorted(userId, { sortBy, showArchived, category: filterCategory })
      .then((groups) => { if (active) setSortedContributions(groups); })
      .catch(() => { if (active) useFallback(); })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [userId, sortBy, showArchived, filterCategory, contributions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, showArchived, filterCategory]);

  // Portfolio metrics across active groups
  const portfolioStats = useMemo(() => {
    const activeList = sortedContributions.filter((g) => !g.archived);
    const totalPooled = activeList.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
    const totalTarget = activeList.reduce((sum, g) => sum + Number(g.target_amount || 0), 0);
    const overallProgress =
      totalTarget > 0 ? Math.min(100, Math.round((totalPooled / totalTarget) * 100)) : 0;

    return {
      count: activeList.length,
      totalPooled,
      totalTarget,
      overallProgress,
    };
  }, [sortedContributions]);

  const totalPages = Math.ceil(sortedContributions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentGroups = sortedContributions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const safeFormatDate = (dateString?: string) => {
    if (!dateString) return "Flexible";
    try {
      let date = parseISO(dateString);
      if (!isValid(date)) date = new Date(dateString);
      if (!isValid(date)) return "Flexible";
      return format(date, "MMM d, yyyy");
    } catch {
      return "Flexible";
    }
  };

  return (
    <div className="min-h-screen">
      <Header mobilePanel />

      <main className="app-page app-panel-page max-w-5xl">
        <section className="app-panel-hero" aria-labelledby="my-groups-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 id="my-groups-heading" className="app-page-title">My groups</h1>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost" className="app-panel-secondary">
                <Link to="/discover"><Compass size={17} aria-hidden="true" /> Discover</Link>
              </Button>
              <Button asChild className="app-panel-primary">
                <Link to="/create-group"><Plus size={17} aria-hidden="true" /> New group</Link>
              </Button>
            </div>
          </div>
          {!isLoading && portfolioStats.count > 0 && (
            <div className="mt-5">
              <p className="panel-kicker text-sm font-medium">Raised across {portfolioStats.count} listed {portfolioStats.count === 1 ? "group" : "groups"}</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[clamp(1.9rem,6vw,2.8rem)] font-semibold leading-tight tracking-[-.055em] tabular-nums break-words">
                  ₦{portfolioStats.totalPooled.toLocaleString()}
                </p>
                <p className="panel-kicker text-sm tabular-nums">of ₦{portfolioStats.totalTarget.toLocaleString()} combined goal</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Combined funding progress" aria-valuenow={portfolioStats.overallProgress}>
                <div className="h-full rounded-full bg-[#dcf6b8]" style={{ width: portfolioStats.overallProgress + "%" }} />
              </div>
            </div>
          )}
        </section>

        <div className="app-panel-body space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="app-section-title">Your groups</h2>
              {filterCategory !== "all" && <p className="text-sm text-muted-foreground">{getCategoryLabel(filterCategory)}</p>}
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal size={16} aria-hidden="true" /> Filters
                  {(filterCategory !== "all" || sortBy !== "date" || showArchived) && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Filters applied" />}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sort and filter groups</DialogTitle>
                  <DialogDescription className="sr-only">Choose which groups to show and how to order them.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="group-category-filter" className="text-sm font-medium">Category</label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger id="group-category-filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <span className="inline-flex items-center gap-2">
                              <CategoryIcon category={category.value} size={14} className="text-primary" />
                              {category.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="group-sort-order" className="text-sm font-medium">Sort by</label>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                      <SelectTrigger id="group-sort-order"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Newest first</SelectItem>
                        <SelectItem value="progress">Most funded</SelectItem>
                        <SelectItem value="category">By category</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-medium">
                    <Checkbox checked={showArchived} onCheckedChange={(value) => setShowArchived(value === true)} />
                    Include archived groups
                  </label>
                </div>
                <DialogClose asChild><Button className="w-full">Show groups</Button></DialogClose>
              </DialogContent>
            </Dialog>
          </div>

        {/* Content */}
        {isLoading ? (
          <BrandLoader variant="page" message="Loading your groups…" />
        ) : sortedContributions.length === 0 ? (
          <Card className="rounded-[1.5rem] p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              {filterCategory === "all" ? "No groups to show" : "No groups in this category"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              {showArchived
                ? "Archived groups are included in this view."
                : "Create your first shared savings pool or discover open community groups."}
            </p>
            {!showArchived && (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Button asChild className="h-11 rounded-xl font-semibold">
                  <Link to="/create-group">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create group
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-xl font-semibold">
                  <Link to="/discover">Explore public groups</Link>
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {currentGroups.map((contribution) => {
                const currentAmount = Number(contribution.current_amount || 0);
                const targetAmount = Number(contribution.target_amount || 0);
                const progressPercentage =
                  targetAmount > 0
                    ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
                    : 0;
                const memberCount = Array.isArray(contribution.contributors)
                  ? contribution.contributors[0]?.count ?? contribution.contributors.length
                  : 0;
                const isPublic = contribution.privacy === "public";

                return (
                  <Link
                    key={contribution.id}
                    to={`/groups/${contribution.id}`}
                    className="group block rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="flex h-full flex-col justify-between rounded-[1.35rem] border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <div>
                        {/* Card Top Strip */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"
                              aria-hidden="true"
                            >
                              <CategoryIcon category={contribution.category} size={20} />
                            </span>
                            <div className="min-w-0">
                              <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-primary">
                                {getCategoryLabel(contribution.category)}
                              </span>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                {isPublic ? (
                                  <Globe className="h-3 w-3" />
                                ) : (
                                  <Lock className="h-3 w-3" />
                                )}
                                <span className="capitalize">
                                  {contribution.frequency || "Flexible"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {contribution.archived && (
                              <Badge variant="secondary" className="text-[10px]">
                                Archived
                              </Badge>
                            )}
                            <span className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:bg-accent group-hover:text-primary">
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-4 line-clamp-1 text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                          {contribution.name || "Unnamed Group"}
                        </h3>
                        {contribution.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {contribution.description}
                          </p>
                        )}
                      </div>

                      {/* Financial Progress & Meta */}
                      <div className="mt-5 space-y-3">
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xl font-extrabold tracking-[-0.035em] text-foreground tabular-nums">
                              ₦{currentAmount.toLocaleString()}
                            </span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground tabular-nums">
                              {progressPercentage}%
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            of ₦{targetAmount.toLocaleString()} goal
                          </p>
                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Users className="h-3.5 w-3.5" />
                            {memberCount} {memberCount === 1 ? "member" : "members"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {safeFormatDate(contribution.end_date || contribution.start_date || contribution.created_at)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
                <p className="text-xs font-medium text-muted-foreground">
                  Showing {startIndex + 1}–{Math.min(endIndex, sortedContributions.length)} of{" "}
                  {sortedContributions.length} groups
                </p>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-9 rounded-xl"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      const showEllipsis =
                        (page === currentPage - 2 && currentPage > 3) ||
                        (page === currentPage + 2 && currentPage < totalPages - 2);

                      if (showEllipsis) {
                        return (
                          <span key={page} className="px-1.5 py-1 text-xs text-muted-foreground">
                            …
                          </span>
                        );
                      }

                      if (!showPage) return null;

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className="h-9 w-9 rounded-xl p-0"
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-9 rounded-xl"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
};

export default AllGroups;
