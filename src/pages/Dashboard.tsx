
import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  UserPlus, 
  Bell, 
  Settings,
  User
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/services/localStorage";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

const Dashboard = () => {
  const [greeting, setGreeting] = useState("");
  const { user, refreshData } = useApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting("Good Morning");
    } else if (hours < 18) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
    
    refreshData();
  }, [refreshData]);
  
  const handleNotificationRead = (id: string) => {
    markNotificationAsRead(id);
    refreshData();
  };
  
  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    refreshData();
  };
  
  const unreadNotifications = user.notifications?.filter(n => !n.read) || [];

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pt-24 pb-8">
        <div className="flex justify-between items-center mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, {user.name?.split(' ')[0]}</h1>
            <p className="text-muted-foreground">Welcome back to your dashboard</p>
          </div>
          <div className="hidden md:flex space-x-2">
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                  {unreadNotifications.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                  <h4 className="font-semibold">Notifications</h4>
                  {user.notifications && user.notifications.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[400px]">
                  {!user.notifications || user.notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    user.notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`p-4 border-b last:border-b-0 ${!notification.read ? 'bg-muted/50' : ''}`}
                        onClick={() => handleNotificationRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-full w-2 h-2 mt-1.5 ${!notification.read ? 'bg-primary' : 'bg-transparent'}`} />
                          <div>
                            <p className="text-sm">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  {user.name?.split(' ')[0]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link to="/settings">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
