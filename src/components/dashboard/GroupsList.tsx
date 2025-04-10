
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { useEffect } from "react";

const GroupsList = () => {
  const navigate = useNavigate();
  const {
    contributions,
    currentUser,
    refreshData
  } = useApp();
  
  // Refresh data when component mounts to ensure we have the latest groups
  useEffect(() => {
    if (refreshData) {
      refreshData();
    }
    // Log current user and contributions for debugging
    console.log("Current user:", currentUser);
    if (contributions && Array.isArray(contributions)) {
      contributions.forEach(group => {
        const isCreator = group.creatorId === currentUser?.id;
        const isMember = Array.isArray(group.members) && (
          // Check if members contains the user ID as a string
          group.members.includes(currentUser?.id) ||
          // Check if members contains objects with the user ID
          group.members.some((member: any) => 
            typeof member === 'object' && member.id === currentUser?.id
          )
        );
        console.log(`Group ${group.name}: isCreator=${isCreator}, isMember=${isMember}`);
      });
    }
    console.log("User's contributions:", contributions);
  }, [refreshData, currentUser, contributions]);
  
  // Get groups where the user is a member or creator
  const getRecentGroups = () => {
    if (!currentUser?.id || !contributions || !Array.isArray(contributions)) {
      console.log("No user ID or contributions array");
      return [];
    }
    
    // Filter contributions to only include ones where the current user is involved
    const userContributions = contributions.filter(group => {
      // Check if the user is the creator
      const isCreator = group.creatorId === currentUser.id;
      
      // Check if the user is a member
      let isMember = false;
      if (group.members && Array.isArray(group.members)) {
        // Handle both cases: when members are strings (IDs) or objects
        isMember = group.members.includes(currentUser.id) || 
                  group.members.some((member: any) => 
                    typeof member === 'object' && member.id === currentUser.id
                  );
      }
      
      return isCreator || isMember;
    });
    
    // Sort by creation date (newest first)
    const sortedContributions = [...userContributions].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    // Log the groups we're going to display
    console.log("Recent groups to display:", sortedContributions);
    
    // Get most recent groups
    return sortedContributions.slice(0, 3);
  };
  
  const recentGroups = getRecentGroups();
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
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
      </CardHeader>
      <CardContent>
        {recentGroups.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">You haven't joined any contribution groups yet</p>
            <Button className="bg-[#2DAE75] hover:bg-[#249e69]" onClick={() => navigate("/create-group")}>
              Create a Group
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentGroups.map(group => {
              // Handle edge cases with progress calculation
              const targetAmount = parseFloat(String(group.targetAmount)) || 0;
              const currentAmount = parseFloat(String(group.currentAmount)) || 0;
              const progressPercentage = targetAmount > 0 
                ? Math.min(100, Math.round((currentAmount / targetAmount) * 100) || 0)
                : 0;
              
              const memberCount = Array.isArray(group.members) ? group.members.length : 0;
              const startDate = group.startDate ? new Date(group.startDate) : new Date();
              
              return (
                <div 
                  key={group.id} 
                  className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-base">{group.name}</h3>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3 mr-1 inline" />
                        <span className="mr-2">{memberCount} members</span>
                        
                        <Calendar className="h-3 w-3 mr-1 inline" />
                        <span>{format(startDate, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {group.frequency}
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
