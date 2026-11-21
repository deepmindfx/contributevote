import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import GroupCard from '@/components/discover/GroupCard';
import SearchFilters from '@/components/discover/SearchFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { DiscoverService, DiscoverFilters, SortOption } from '@/services/supabase/discoverService';

export default function Discover() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>('newest');
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
        console.error('Error fetching groups:', error);
        setHasError(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, sortBy, currentPage, retry]);

  const handleFiltersChange = (newFilters: DiscoverFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setFilters({ ...filters, search: query });
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="app-page max-w-6xl">
        <div className="mb-6">
          <h1 className="app-page-title">Discover groups</h1>
          <p className="mt-1 text-muted-foreground">Find a public group to support or join.</p>
        </div>
        {/* Search and Filters */}
        <div className="mb-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <SearchFilters
            filters={filters}
            sortBy={sortBy}
            onFiltersChange={handleFiltersChange}
            onSortChange={handleSortChange}
            onSearch={handleSearch}
          />
        </div>

        {/* Results Count */}
        <div className="mb-4">
          {!hasError && (
            <p className="text-sm text-muted-foreground" role="status">
              {loading ? 'Loading groups…' : `${groups.length} ${groups.length === 1 ? 'group' : 'groups'} on this page`}
            </p>
          )}
        </div>

        {/* Groups Grid */}
        {hasError ? (
          <Card className="rounded-2xl p-6 text-center">
            <h2 className="text-lg font-semibold">Couldn’t load groups</h2>
            <p className="mb-4 mt-1 text-muted-foreground">Check your connection and try again.</p>
            <Button className="h-11" onClick={() => setRetry((attempt) => attempt + 1)}>Try again</Button>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(12)].map((_, i) => (
              <Card key={i} className="h-[400px]">
                <CardContent className="pt-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card className="rounded-2xl p-6 text-center sm:p-12">
            <Search className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
            <h3 className="text-xl font-bold mb-2">No groups found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search query
            </p>
            <Button onClick={() => handleFiltersChange({})}>
              Clear Filters
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    // Show first, last, current, and adjacent pages
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="icon"
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
