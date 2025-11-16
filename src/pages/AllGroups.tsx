import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users, Calendar, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { format, isValid, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { 
  getGroupsSorted,
  CATEGORIES,
  getCategoryIcon 
} from '@/services/supabase/groupEnhancementService';

const ITEMS_PER_PAGE = 9;
const AllGroups = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { contributions } = useSupabaseContribution();
  const [sortBy, setSortBy] = useState<'date' | 'category' | 'progress'>('date');
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortedContributions, setSortedContributions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user?.id) {
      fetchGroups();
    }
  }, [user, sortBy, showArchived, filterCategory, contributions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, showArchived, filterCategory]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const groupsPromise = getGroupsSorted(user.id, {
        sortBy,
        showArchived,
        category: filterCategory
      });
      
      const groups = await Promise.race([groupsPromise, timeoutPromise]) as any;
      setSortedContributions(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      // Fallback to local data from context
      setSortedContributions(contributions);
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(sortedContributions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentGroups = sortedContributions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper function to safely format dates
  const safeFormatDate = dateString => {
    try {
      // Check if dateString is undefined or null
      if (!dateString) {
        return "No date";
      }

      // Try to parse the date using parseISO first for ISO strings
      let date;
      try {
        date = parseISO(dateString);
      } catch (err) {
        // If parseISO fails, try direct Date constructor
        date = new Date(dateString);
      }

      // Verify the date is valid
      if (!isValid(date)) {
        console.log("Invalid date in AllGroups:", dateString);
        return "Invalid date";
      }
      return format(date, 'MMM d, yyyy');
    } catch (err) {
      console.error("Error formatting date in AllGroups:", err, "for date:", dateString);
      return "Invalid date";
    }
  };
  return <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
            <h1 className="font-bold text-2xl">All Contribution Groups</h1>
            <Button size="sm" asChild className="bg-green-600 hover:bg-green-700">
              <Link to="/create-group">Create New Group</Link>
            </Button>
          </div>
          
          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap gap-3">
              {/* Sort Dropdown */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">📅 Date Created</SelectItem>
                  <SelectItem value="category">📂 Category</SelectItem>
                  <SelectItem value="progress">📊 Progress</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Show Archived Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="show-archived-all"
                  checked={showArchived} 
                  onCheckedChange={(checked) => setShowArchived(checked as boolean)}
                />
                <label htmlFor="show-archived-all" className="text-sm cursor-pointer">
                  Show Archived
                </label>
              </div>
            </div>
          </Card>
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading groups...</p>
          </div>
        ) : sortedContributions.length === 0 ? <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {showArchived ? "No archived groups" : "No contribution groups"}
              </h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {showArchived 
                  ? "You don't have any archived groups yet."
                  : "You haven't created or joined any contribution groups yet. Start a new group or join an existing one."
                }
              </p>
              {!showArchived && (
                <Button asChild className="bg-green-600 hover:bg-green-700">
                  <Link to="/create-group">Create New Group</Link>
                </Button>
              )}
            </CardContent>
          </Card> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentGroups.map(contribution => {
          // Add null checks and default values
          const currentAmount = contribution.current_amount || 0;
          const targetAmount = contribution.target_amount || 1; // Prevent division by zero
          const progressPercentage = Math.min(100, Math.round(currentAmount / targetAmount * 100) || 0);
          return <Card key={contribution.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCategoryIcon(contribution.category)}</span>
                        <Badge className="capitalize">{contribution.category || "General"}</Badge>
                      </div>
                      <Badge variant="outline" className="capitalize">{contribution.frequency || "N/A"}</Badge>
                    </div>
                    {contribution.archived && (
                      <Badge variant="secondary" className="mb-2 bg-orange-100 dark:bg-orange-950">
                        📦 Archived
                      </Badge>
                    )}
                    <CardTitle>{contribution.name || "Unnamed Group"}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Started {safeFormatDate(contribution.startDate)}
                      </div>
                      <div className="flex items-center mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        {contribution.members?.length || 0} members
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-medium">{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ₦{currentAmount.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        of ₦{targetAmount.toLocaleString()} goal
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link to={`/groups/${contribution.id}`}>
                        View Details
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>;
        })}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, sortedContributions.length)} of {sortedContributions.length} groups
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage = 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    const showEllipsis = 
                      (page === currentPage - 2 && currentPage > 3) ||
                      (page === currentPage + 2 && currentPage < totalPages - 2);
                    
                    if (showEllipsis) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    
                    if (!showPage) return null;
                    
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="w-10"
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
      
      <MobileNav />
    </div>;
};
export default AllGroups;