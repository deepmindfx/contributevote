
import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UserPlus, Bell } from "lucide-react";

const Dashboard = () => {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting("Good Morning");
    } else if (hours < 18) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pt-24 pb-8">
        <div className="flex justify-between items-center mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, John</h1>
            <p className="text-muted-foreground">Welcome back to your dashboard</p>
          </div>
          <div className="hidden md:flex space-x-2">
            <Button variant="outline" size="sm" className="hidden md:flex">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
            <Button size="sm" asChild>
              <Link to="/create-group">
                <UserPlus className="h-4 w-4 mr-2" />
                New Group
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 animate-slide-up">
            <WalletCard />
          </div>
          
          <div className="md:col-span-2">
            <div className="space-y-6">
              <GroupsList />
              <RecentActivity />
            </div>
          </div>
        </div>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default Dashboard;
