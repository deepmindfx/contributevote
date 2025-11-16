
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { format, isValid, parseISO } from "date-fns";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { 
  getGroupsSorted,
  CATEGORIES,
  getCategoryIcon 
} from '@/services/supabase/groupEnhancementService';

const GroupsList = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { contributions } = useSupabaseContribution();
  const [sortBy, setSortBy] = useState<'date' | 'category' | 'progress'>('date');
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortedGroups, setSortedGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchGroups();
    }
  }, [user, sortBy, showArchived, filterCategory, contributions]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const groups = await getGroupsSorted(user.id, {
        sortBy,
        showArchived,
        category: filterCategory
      });
      setSortedGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      // Fallback to local sorting if service fails
      setSortedGroups(contributions.slice(0, 3));
    } finally {
      setIsLoading(false);
    }
  };
  
  const recentGroups = sortedGroups.slice(0, 3);
  
  // Helper function to safely format dates
  const safeFormatDate = (dateString) => {
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
        console.log("Invalid date:", dateString);
        return "Invalid date";
      }
      
      return format(date, 'MMM d, yyyy');
    } catch (err) {
      console.error("Error formatting date:", err, "for date:", dateString);
      return "Invalid date";
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center mb-4">
          <div>
            <CardTitle>My Groups</CardTitle>
            <CardDescription>Your contribution groups</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/all-groups">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Sort Dropdown */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">📅 Date</SelectItem>
              <SelectItem value="category">📂 Category</SelectItem>
              <SelectItem value="progress">📊 Progress</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
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
              id="show-archived"
              checked={showArchived} 
              onCheckedChange={(checked) => setShowArchived(checked as boolean)}
            />
            <label htmlFor="show-archived" className="text-sm cursor-pointer">
              Show Archived
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading groups...</p>
          </div>
        ) : recentGroups.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              {showArchived ? "No archived groups found" : "You haven't joined any contribution groups yet"}
            </p>
            {!showArchived && (
              <Button className="bg-[#2DAE75] hover:bg-[#249e69]" onClick={() => navigate("/create-group")}>
                Create a Group
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {recentGroups.map(group => {
              // Add null checks and default values
              const currentAmount = group.current_amount || 0;
              const targetAmount = group.target_amount || 1; // Prevent division by zero
              const progressPercentage = Math.min(100, Math.round((currentAmount / targetAmount) * 100) || 0);
              
              return (
                <div 
                  key={group.id} 
                  className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{getCategoryIcon(group.category)}</span>
                        <h3 className="font-medium text-base">{group.name || "Unnamed Group"}</h3>
                        {group.archived && (
                          <Badge variant="secondary" className="text-xs">
                            📦 Archived
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3 mr-1 inline" />
                        <span className="mr-2">{(group.members?.length || 0)} members</span>
                        
                        <Calendar className="h-3 w-3 mr-1 inline" />
                        <span>{safeFormatDate(group.startDate)}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {group.frequency || "N/A"}
                    </Badge>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <div className="text-muted-foreground">Progress ({progressPercentage}%)</div>
                      <div className="text-sm font-medium">
                        ₦{currentAmount.toLocaleString()} of ₦{targetAmount.toLocaleString()}
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        {recentGroups.length > 0 && (
          <Button onClick={() => navigate("/create-group")} className="w-full bg-[#2DAE75] hover:bg-[#249e69]">
            Create New Group
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default GroupsList;
