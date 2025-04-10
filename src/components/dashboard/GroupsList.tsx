
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import ShareContribution from "../contributions/ShareContribution";

const GroupsList = () => {
  const navigate = useNavigate();
  const {
    contributions,
    currentUser,
    refreshData
  } = useApp();
  
  // Force a refresh when the component mounts to ensure we have the latest data
  useEffect(() => {
    if (refreshData) {
      refreshData();
    }
  }, [refreshData]);
  
  // Get recent groups where the user is a member or creator
  const getRecentGroups = () => {
    if (!currentUser?.id || !contributions) {
      console.log("User or contributions not available", { currentUser, contributions });
      return [];
    }
    
    if (!Array.isArray(contributions)) {
      console.log("Contributions is not an array", contributions);
      return [];
    }
    
    console.log("All contributions:", contributions);
    console.log("Current user:", currentUser);
    
    // Fix: Properly handle group membership and creator checking
    const userContributions = contributions.filter(group => {
      // Check if the user is a creator
      const isCreator = group.creatorId === currentUser.id;
      
      // Check if the user is a member
      let isMember = false;
      if (group.members && Array.isArray(group.members)) {
        // Check if members contains the user ID as a string
        if (group.members.includes(currentUser.id)) {
          isMember = true;
        }
        // Also check if members is an array of objects with id property
        else if (group.members.some(member => typeof member === 'object' && member?.id === currentUser.id)) {
          isMember = true;
        }
      }
      
      console.log(`Group ${group.name}: isCreator=${isCreator}, isMember=${isMember}`);
      return isCreator || isMember;
    });
    
    console.log("User's contributions:", userContributions);
    
    // Sort by creation date (newest first)
    const sortedContributions = [...userContributions].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : Date.now();
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : Date.now();
      return dateB - dateA;
    });
    
    // Get most recent 3 groups
    return sortedContributions.slice(0, 3);
  };
  
  const recentGroups = getRecentGroups();
  console.log("Recent groups to display:", recentGroups);
  
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
        {!recentGroups || recentGroups.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">You haven't joined any contribution groups yet</p>
            <Button className="bg-[#2DAE75] hover:bg-[#249e69]" onClick={() => navigate("/create-group")}>
              Create a Group
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentGroups.map(group => {
              // Safely calculate progress percentage with fallbacks
              const currentAmount = Number(group.currentAmount) || 0;
              const targetAmount = Number(group.targetAmount) || 1; // Prevent division by zero
              const progressPercentage = Math.min(100, Math.round((currentAmount / targetAmount) * 100));
              
              // Use try-catch to prevent rendering errors
              try {
                return (
                  <div 
                    key={group.id} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" 
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="cursor-pointer" onClick={() => navigate(`/groups/${group.id}`)}>
                        <h3 className="font-medium text-base">{group.name || "Unnamed Group"}</h3>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Users className="h-3 w-3 mr-1 inline" />
                          <span className="mr-2">
                            {group.members && Array.isArray(group.members) 
                              ? group.members.length 
                              : 1} members
                          </span>
                          
                          <Calendar className="h-3 w-3 mr-1 inline" />
                          <span>
                            {group.startDate 
                              ? format(new Date(group.startDate), 'MMM d, yyyy')
                              : "No date set"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ShareContribution 
                          contributionId={group.id} 
                          title={group.name} 
                          description={group.description}
                          shareCode={group.shareCode || group.id.substring(0, 8)}
                        />
                        <Badge variant="outline" className="capitalize text-xs">
                          {group.frequency || "N/A"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="mt-3 cursor-pointer" onClick={() => navigate(`/groups/${group.id}`)}>
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
              } catch (error) {
                console.error("Error rendering group:", error, group);
                return null;
              }
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        {recentGroups && recentGroups.length > 0 && (
          <Button onClick={() => navigate("/create-group")} className="w-full bg-[#2DAE75] hover:bg-[#249e69]">
            Create New Group
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default GroupsList;
