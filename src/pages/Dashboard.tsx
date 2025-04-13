
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PieChart } from 'lucide-react';
import WalletCard from "@/components/dashboard/WalletCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { useQuery } from "@tanstack/react-query";
import { getStatistics } from "@/services/localStorage";
import { Stats } from "@/types";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useApp();
  
  const { data: stats, isLoading, isError } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: getStatistics,
  });
  
  useEffect(() => {
    // Refresh user data when the dashboard loads
    refreshUser();
    
    if (!user) {
      navigate("/auth");
    }
  }, []);
  
  if (!user) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="container relative min-h-screen">
      <div className="md:flex gap-4 py-6">
        <div className="md:w-1/3 space-y-4">
          <WalletCard />
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar>
                  {user.profileImage ? (
                    <AvatarImage src={user.profileImage} alt={user.name || "Profile"} />
                  ) : (
                    <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div className="text-lg font-semibold">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Account Status:</div>
                <div className="text-sm">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      user.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {user.status === "active" ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate("/settings")}>
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:w-2/3 space-y-4">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
              <CardDescription>Your contribution statistics</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading stats...</p>
              ) : isError ? (
                <p>Error loading stats.</p>
              ) : (
                <Table>
                  <TableCaption>A summary of your contribution statistics.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Statistic</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Total Contributions</TableCell>
                      <TableCell>{stats?.totalContributions}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Active Contributions</TableCell>
                      <TableCell>{stats?.activeContributions}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Contributed</TableCell>
                      <TableCell>NGN {stats?.totalContributed.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Members</TableCell>
                      <TableCell>{stats?.totalMembers}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
