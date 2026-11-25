import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { LandingHeader } from "@/components/landing/LandingHeader";
import GroupCard from "@/components/discover/GroupCard";
import SearchFilters from "@/components/discover/SearchFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { DiscoverService, DiscoverFilters, SortOption } from "@/services/supabase/discoverService";
import "@/styles/landing.css";

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

  const startPath = isAuthenticated ? "/create-group" : "/auth?mode=signup";

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
    <div className="cb-public-light min-h-dvh">
      {isAuthenticated ? (
        <Header />
      ) : (
        <LandingHeader isAuthenticated={false} startPath={startPath} />
      )}

      <main
        className={
          isAuthenticated
            ? "cb-discover-main cb-discover-main--workspace cp-page-enter"
            : "cb-discover-main cb-discover-main--guest cp-page-enter"
        }
      >
        {/* Light Cashbuddy-Aligned Architectural Hero */}
        <section className="cb-discover-hero" aria-labelledby="discover-title">
          <div className="cb-hero-grid-bg" aria-hidden="true" />
          <div className="cb-discover-glow" aria-hidden="true" />

          <div className="cb-discover-container relative z-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="cb-hero-kicker mb-4">
                  <span className="cb-hero-kicker-tag">DISCOVER</span>
                  <span className="cb-hero-kicker-text">
                    Verified Community Pools &amp; Public Causes
                  </span>
                </div>

                <h1 id="discover-title" className="cb-discover-title">
                  Support transparent{" "}
                  <span className="text-[#059669]">public pools.</span>
                </h1>

                <p className="cb-discover-subtitle">
                  Browse verified faith projects, medical relief drives, student initiatives, and
                  community infrastructure pools — with live Naira ledgers and vote-protected
                  withdrawals.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link to={startPath} className="cb-btn cb-btn--primary">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  <span>Start a Public Pool</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Elevated Crisp White Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mt-7" role="search">
              <div className="cb-discover-search">
                <Search className="ml-3.5 h-4 w-4 shrink-0 text-[#64717d]" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search public groups"
                  placeholder="Search by cause, masjid, church, invention, or pool name…"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium text-[#0f1729] placeholder:text-[#7b8794] focus:outline-none"
                />
                {searchDraft && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[#64717d] transition-colors hover:bg-black/5 hover:text-[#0f1729]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="submit" className="cb-discover-search-btn">
                  Search
                </button>
              </div>
            </form>

            {/* Micro Trust Highlights */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#64717d]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#059669]" />
                70% voter quorum on vote-gated pools
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                0% CollectiPay fee on charity withdrawals
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#059669]" />
                Instant shareable NGN receipts
              </span>
            </div>
          </div>
        </section>

        {/* Clean Light Results & Bento Grid Body */}
        <div className="cb-discover-container space-y-6 pb-16 pt-2">
          <SearchFilters
            filters={filters}
            sortBy={sortBy}
            onFiltersChange={handleFiltersChange}
            onSortChange={handleSortChange}
          />

          {/* Subtle Results Line */}
          {!hasError && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#64717d]">
              <p role="status">
                {loading
                  ? "Finding public pools…"
                  : `${groups.length} ${groups.length === 1 ? "public pool" : "public pools"} shown`}
              </p>
              {filters.search && (
                <span>
                  Matching <strong className="text-[#0f1729]">“{filters.search}”</strong>
                </span>
              )}
            </div>
          )}

          {/* Grid / Empty / Error States */}
          {hasError ? (
            <div className="cb-light-surface-card p-12 text-center">
              <h2 className="font-['Instrument_Sans',sans-serif] text-xl font-extrabold text-[#0f1729]">
                Couldn’t load public pools
              </h2>
              <p className="mt-1.5 text-sm text-[#64717d]">
                Check your internet connection and try again.
              </p>
              <button
                type="button"
                className="cb-btn cb-btn--primary mt-5"
                onClick={() => setRetry((attempt) => attempt + 1)}
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="cb-light-surface-card space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-2xl bg-[#e8eeeb]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-20 bg-[#e8eeeb]" />
                      <Skeleton className="h-3 w-32 bg-[#e8eeeb]" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-3/4 bg-[#e8eeeb]" />
                  <Skeleton className="h-8 w-full bg-[#e8eeeb]" />
                  <Skeleton className="h-2 w-full rounded-full bg-[#e8eeeb]" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-24 bg-[#e8eeeb]" />
                    <Skeleton className="h-9 w-28 rounded-xl bg-[#e8eeeb]" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="cb-light-surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e4f5ec] text-[#06694d]">
                <Compass className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-['Instrument_Sans',sans-serif] text-xl font-extrabold text-[#0f1729]">
                No matching public pools
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-[#64717d]">
                Try another category or search keyword, or launch the first public pool for your
                community cause.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFiltersChange({})}
                  className="cb-btn cb-btn--ghost"
                >
                  Reset filters
                </button>
                <Link to={startPath} className="cb-btn cb-btn--primary">
                  Create a pool
                </Link>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const pinnedSpotlight =
                  currentPage === 1 &&
                  !filters.spotlightOnly &&
                  !filters.verifiedOnly &&
                  !filters.search
                    ? groups.filter((g) => g.is_pinned || Boolean(g.spotlight_label))
                    : [];
                const regularGroups =
                  pinnedSpotlight.length > 0
                    ? groups.filter((g) => !g.is_pinned && !g.spotlight_label)
                    : groups;

                return (
                  <div className="space-y-9">
                    {pinnedSpotlight.length > 0 && (
                      <section className="space-y-4" aria-label="Spotlight and Most Needed pools">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fef3df] text-[#b45309]">
                              <Flame className="h-4 w-4" />
                            </span>
                            <div>
                              <h2 className="font-['Instrument_Sans',sans-serif] text-base font-extrabold tracking-tight text-[#0f1729]">
                                Most Needed &amp; Verified Spotlight
                              </h2>
                              <p className="text-xs text-[#64717d]">
                                Priority community causes verified by CollectiPay
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {pinnedSpotlight.map((group) => (
                            <GroupCard key={group.id} group={group} lightSurface />
                          ))}
                        </div>
                      </section>
                    )}

                    {regularGroups.length > 0 && (
                      <section className="space-y-4" aria-label="All community pools">
                        {pinnedSpotlight.length > 0 && (
                          <h2 className="font-['Instrument_Sans',sans-serif] text-base font-extrabold tracking-tight text-[#0f1729]">
                            All Community Pools
                          </h2>
                        )}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {regularGroups.map((group) => (
                            <GroupCard key={group.id} group={group} lightSurface />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                );
              })()}

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-6">
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f1729] shadow-sm transition-all hover:bg-[#edf3f0] disabled:opacity-40"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      const active = currentPage === page;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => goToPage(page)}
                          className={
                            active
                              ? "grid h-10 w-10 place-items-center rounded-xl bg-[#071913] text-xs font-bold text-white shadow-md tabular-nums"
                              : "grid h-10 w-10 place-items-center rounded-xl bg-white text-xs font-semibold text-[#0f1729] shadow-sm transition-all hover:bg-[#edf3f0] tabular-nums"
                          }
                        >
                          {page}
                        </button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-1.5 text-sm text-[#64717d]">
                          …
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#0f1729] shadow-sm transition-all hover:bg-[#edf3f0] disabled:opacity-40"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
