import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Compass, Plus, Search, X } from "lucide-react";
import Header from "@/components/layout/Header";
import GroupCard from "@/components/discover/GroupCard";
import SearchFilters from "@/components/discover/SearchFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { DiscoverService, DiscoverFilters, SortOption } from "@/services/supabase/discoverService";

export default function Discover() {
  const { isAuthenticated } = useSupabaseUser();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHasError(false);
    void DiscoverService.getPublicGroups(filters, sortBy, currentPage, 12)
      .then((result) => {
        if (!active) return;
        setGroups(result.groups);
        setTotalPages(result.totalPages);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Error fetching groups:", error);
        setHasError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, sortBy, currentPage, retry]);

  const handleFiltersChange = (newFilters: DiscoverFilters) => {
    setFilters(newFilters);
    if (!newFilters.search) setSearchDraft("");
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchDraft.trim() || undefined }));
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchDraft("");
    setFilters((prev) => ({ ...prev, search: undefined }));
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-dvh bg-background">
      <Header mobilePanel />

      <main className="app-page app-panel-page cp-page-enter max-w-6xl">
        {/* Deep-Emerald Discover Hero with Integrated Search */}
        <section className="app-panel-hero" aria-labelledby="discover-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="panel-kicker inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Compass className="h-3.5 w-3.5 text-[#dbf5b4]" />
                Public Pools &amp; Crowdfunding
              </p>
              <h1 id="discover-title" className="app-page-title mt-1.5">
                Discover groups
              </h1>
              <p className="panel-kicker mt-1.5 max-w-lg text-sm">
                Support verified community campaigns, faith projects, and inventions with transparent progress.
              </p>
            </div>

            <Button asChild className="app-panel-primary h-11 shrink-0 gap-1.5 rounded-xl font-bold">
              <Link to={isAuthenticated ? "/create-group" : "/auth?mode=signup"}>
                <Plus className="h-4 w-4" />
                Start a pool
              </Link>
            </Button>
          </div>

          {/* Sleek Hero Search Bar */}
          <form onSubmit={handleSearchSubmit} className="mt-5" role="search">
            <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/12 p-1.5 backdrop-blur-md focus-within:border-[#dbf5b4]/70 focus-within:bg-white/18">
              <Search className="ml-3 h-4 w-4 shrink-0 text-[#cce8da]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search public groups"
                placeholder="Search by cause, masjid, church, invention, or pool name…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[#bddccf] focus:outline-none"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#cce8da] hover:bg-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <Button
                type="submit"
                size="sm"
                className="app-panel-primary h-10 shrink-0 rounded-xl px-4 font-bold"
              >
                Search
              </Button>
            </div>
          </form>
        </section>

        {/* Clean Overlapping Body */}
        <div className="app-panel-body space-y-5">
          <SearchFilters
            filters={filters}
            sortBy={sortBy}
            onFiltersChange={handleFiltersChange}
            onSortChange={handleSortChange}
          />

          {/* Subtle Results Line */}
          {!hasError && (
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <p role="status">
                {loading
                  ? "Finding public pools…"
                  : `${groups.length} ${groups.length === 1 ? "public pool" : "public pools"} shown`}
              </p>
              {filters.search && (
                <span>
                  Matching <strong className="text-foreground">“{filters.search}”</strong>
                </span>
              )}
            </div>
          )}

          {/* Grid / Empty / Error States */}
          {hasError ? (
            <div className="cp-card-native p-10 text-center">
              <h2 className="text-lg font-bold text-foreground">Couldn’t load public pools</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your connection and try again.
              </p>
              <Button
                className="mt-4 h-11 rounded-xl"
                onClick={() => setRetry((attempt) => attempt + 1)}
              >
                Try again
              </Button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="cp-card-native space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-2xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-24 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="cp-card-native flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
                <Search className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">No matching pools</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Try another category or search term, or start your own public pool.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleFiltersChange({})}
                  className="h-11 rounded-xl"
                >
                  Reset filters
                </Button>
                <Button asChild className="h-11 rounded-xl">
                  <Link to={isAuthenticated ? "/create-group" : "/auth?mode=signup"}>
                    Create a pool
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-10 w-10 rounded-xl tabular-nums"
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-1.5 text-sm text-muted-foreground">
                          …
                        </span>
                      );
                    }
                    return null;
                  })}

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
