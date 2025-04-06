
import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

const AllGroups = () => {
  const navigate = useNavigate();
  const { contributions } = useApp();

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
        
        {contributions.length === 0 ? (
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
            {contributions.map(contribution => {
              const progressPercentage = Math.min(
                100,
                Math.round((contribution.currentAmount / contribution.targetAmount) * 100)
              );
              
              return (
                <Card key={contribution.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between">
                      <Badge className="mb-2 capitalize">{contribution.category}</Badge>
                      <Badge variant="outline" className="capitalize">{contribution.frequency}</Badge>
                    </div>
                    <CardTitle>{contribution.name}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Started {format(new Date(contribution.startDate), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        {contribution.members.length} members
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
                        ₦{contribution.currentAmount.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        of ₦{contribution.targetAmount.toLocaleString()} goal
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
