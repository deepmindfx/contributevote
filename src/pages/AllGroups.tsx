import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import BrandLoader from "@/components/ui/BrandLoader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Archive,
  Globe,
  Lock,
} from "lucide-react";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { format, isValid, parseISO } from "date-fns";
import {
  getGroupsSorted,
  CATEGORIES,
  getCategoryIcon,
  getCategoryLabel,
} from "@/services/supabase/groupEnhancementService";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 9;

const AllGroups = () => {
  const { user } = useSupabaseUser();
  const { contributions } = useSupabaseContribution();
  const [sortBy, setSortBy] = useState<"date" | "category" | "progress">("date");
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortedContributions, setSortedContributions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user?.id) {
      fetchGroups();
    }
  }, [user, sortBy, showArchived, filterCategory, contributions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, showArchived, filterCategory]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 10000)
      );

      const groupsPromise = getGroupsSorted(user.id, {
        sortBy,
        showArchived,
        category: filterCategory,
      });

      const groups = (await Promise.race([groupsPromise, timeoutPromise])) as any;
      setSortedContributions(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      setSortedContributions(contributions);
    } finally {
      setIsLoading(false);
    }
  };

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
      <Header />

      <main className="app-page max-w-5xl space-y-5">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="app-page-title">My groups</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your shared pools, progress, and group governance.
            </p>
          </div>
          <Button asChild className="h-11 rounded-xl font-semibold">
            <Link to="/create-group">
              <Plus className="mr-1.5 h-4 w-4" />
              New group
            </Link>
          </Button>
        </div>

        {/* Native Portfolio Summary Banner */}
        {!isLoading && portfolioStats.count > 0 && (
          <section className="group-vault-hero rounded-[1.5rem] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#a9ccb9]">
                  Total Pooled ({portfolioStats.count} active{" "}
                  {portfolioStats.count === 1 ? "group" : "groups"})
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-3xl font-extrabold tracking-[-0.045em] text-white tabular-nums sm:text-4xl">
                    ₦{portfolioStats.totalPooled.toLocaleString()}
                  </span>
                  <span className="text-sm text-[#b9d9c8] tabular-nums">
                    of ₦{portfolioStats.totalTarget.toLocaleString()} combined target
                  </span>
                </div>
              </div>
              <span className="self-start rounded-full bg-[#dbf5b4] px-3 py-1 text-xs font-bold text-[#0c3027] tabular-nums sm:self-end">
                {portfolioStats.overallProgress}% funded
              </span>
            </div>
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-white/14">
              <div
                className="h-full rounded-full bg-[#dbf5b4] transition-all duration-500"
                style={{ width: `${portfolioStats.overallProgress}%` }}
              />
            </div>
          </section>
        )}

        {/* Native Filter Bar: Scrollable Category Pills + Compact Controls */}
        <div className="space-y-3">
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors",
                filterCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setFilterCategory(cat.value)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors",
                  filterCategory === cat.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span aria-hidden="true">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {sortedContributions.length}{" "}
              {sortedContributions.length === 1 ? "group" : "groups"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
                  showArchived
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                <Archive className="h-3.5 w-3.5" />
                Archived
              </button>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 w-[148px] rounded-xl text-xs font-semibold" aria-label="Sort groups">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Newest first</SelectItem>
                  <SelectItem value="progress">Most funded</SelectItem>
                  <SelectItem value="category">By category</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
              {showArchived ? "No archived groups" : "No groups match this filter"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              {showArchived
                ? "Archived groups you restore or hide will appear here."
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-xl"
                              aria-hidden="true"
                            >
                              {getCategoryIcon(contribution.category)}
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

                <div className="flex items-center gap-1.5">
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
      </main>
    </div>
  );
};

export default AllGroups;
