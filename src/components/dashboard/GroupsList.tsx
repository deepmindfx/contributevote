import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";
import { Users, Calendar, ArrowRight } from "lucide-react";
const GroupsList = () => {
  const navigate = useNavigate();
  const {
    contributions
  } = useApp();
  const getRecentGroups = () => {
    // Get most recent 3 groups
    return contributions.slice(0, 3);
  };
  const recentGroups = getRecentGroups();
  return <Card>
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
        {recentGroups.length === 0 ? <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">You haven't joined any contribution groups yet</p>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate("/create-group")}>
              Create a Group
            </Button>
          </div> : <div className="space-y-4">
            {recentGroups.map(group => {
          const progressPercentage = Math.min(100, Math.round(group.currentAmount / group.targetAmount * 100) || 0);
          return <div key={group.id} className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/groups/${group.id}`)}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-base">{group.name}</h3>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3 mr-1 inline" />
                        <span className="mr-2">{group.members.length} members</span>
                        
                        <Calendar className="h-3 w-3 mr-1 inline" />
                        <span>{format(new Date(group.startDate), 'MMM d, yyyy')}</span>
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
                        ₦{group.currentAmount.toLocaleString()} of ₦{group.targetAmount.toLocaleString()}
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-1.5" />
                  </div>
                </div>;
        })}
          </div>}
      </CardContent>
      <CardFooter className="pt-0">
        {recentGroups.length > 0 && <Button onClick={() => navigate("/create-group")} className="w-full bg-[#2dae75]">
            Create New Group
          </Button>}
      </CardFooter>
    </Card>;
};
export default GroupsList;