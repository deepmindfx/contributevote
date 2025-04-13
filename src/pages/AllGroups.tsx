
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  ArrowUpRight
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { format, isValid, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";

const AllGroups = () => {
  const navigate = useNavigate();
  const { contributions } = useApp();

  // Sort contributions by creation date (newest first)
  const sortedContributions = [...contributions].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA; // Sort in descending order (newest first)
  });

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
        console.log("Invalid date in AllGroups:", dateString);
        return "Invalid date";
      }
      
      return format(date, 'MMM d, yyyy');
    } catch (err) {
      console.error("Error formatting date in AllGroups:", err, "for date:", dateString);
      return "Invalid date";
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">All Contribution Groups</h1>
            <Button size="sm" asChild className="bg-green-600 hover:bg-green-700">
              <Link to="/create-group">Create New Group</Link>
            </Button>
          </div>
        </div>
        
        {sortedContributions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No contribution groups</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                You haven't created or joined any contribution groups yet. Start a new group or join an existing one.
              </p>
              <Button asChild className="bg-green-600 hover:bg-green-700">
                <Link to="/create-group">Create New Group</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedContributions.map(contribution => {
              // Add null checks and default values
              const currentAmount = contribution.currentAmount || 0;
              const targetAmount = contribution.targetAmount || 1; // Prevent division by zero
              const progressPercentage = Math.min(
                100,
                Math.round((currentAmount / targetAmount) * 100) || 0
              );
              
              return (
                <Card key={contribution.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between">
                      <Badge className="mb-2 capitalize">{contribution.category || "General"}</Badge>
                      <Badge variant="outline" className="capitalize">{contribution.frequency || "N/A"}</Badge>
                    </div>
                    <CardTitle>{contribution.name || "Unnamed Group"}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Started {safeFormatDate(contribution.startDate)}
                      </div>
                      <div className="flex items-center mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        {(contribution.members?.length || 0)} members
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
                </Card>
              );
            })}
          </div>
        )}
      </main>
      
      <MobileNav />
    </div>
  );
};

export default AllGroups;
