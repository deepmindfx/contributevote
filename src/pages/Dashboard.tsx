import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import WalletCard from "@/components/dashboard/WalletCard";
import GroupsList from "@/components/dashboard/GroupsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UserPlus, Bell, Settings, User, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/services/localStorage";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

const Dashboard = () => {
  const {
    user,
    refreshData,
    contributions
  } = useApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  useEffect(() => {
    // Refresh data when dashboard loads to ensure shared contributions are visible
    refreshData();
  }, [refreshData]);

  // Force an additional refresh a few seconds after the component mounts 
  // to ensure we have the latest notifications and shared contributions
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 1500);
    return () => clearTimeout(timer);
  }, [refreshData]);
  
  const handleNotificationRead = (id: string, relatedId?: string) => {
    markNotificationAsRead(id);
    refreshData();

    // If notification is related to a contribution, navigate to it
    if (relatedId) {
      const isContribution = contributions.some(c => c.id === relatedId);
      if (isContribution) {
        setNotificationsOpen(false);
        // Use window.location to ensure full page reload if needed
        window.location.href = `/groups/${relatedId}`;
      }
    }
  };
  
  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    refreshData();
  };
  
  const unreadNotifications = user.notifications?.filter(n => !n.read) || [];
  
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pt-8 pb-8">
        <div className="flex justify-between items-center mb-2 animate-fade-in">
          <div>
            {/* Greeting removed as requested */}
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
                  {user.notifications && user.notifications.length > 0 && <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                      Mark all read
                    </Button>}
                </div>
                <ScrollArea className="h-[400px]">
                  {!user.notifications || user.notifications.length === 0 ? <div className="p-4 text-center text-muted-foreground">
                      <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No notifications</p>
                    </div> : user.notifications.map(notification => <div key={notification.id} className={`p-4 border-b last:border-b-0 ${!notification.read ? 'bg-muted/50' : ''} 
                          hover:bg-muted/30 cursor-pointer transition-colors`} onClick={() => handleNotificationRead(notification.id, notification.relatedId)}>
                        <div className="flex items-start gap-3">
                          <div className={`rounded-full w-2 h-2 mt-1.5 ${!notification.read ? 'bg-green-600' : 'bg-transparent'}`} />
                          <div className="flex-1">
                            <p className="text-sm">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          {notification.read && <div className="text-muted-foreground opacity-50">
                              <X className="h-3 w-3" />
                            </div>}
                        </div>
                      </div>)}
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
            
            <Button size="sm" asChild className="bg-[#2DAE75] hover:bg-[#249e69]">
              <Link to="/create-group">
                <UserPlus className="h-4 w-4 mr-2" />
                New Group
              </Link>
            </Button>

            <Button size="sm" variant="outline" asChild>
              <Link to="/votes">
                See Votes
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4">
          <div className="md:col-span-5 animate-slide-up">
            <WalletCard />
          </div>
          
          <div className="md:col-span-7">
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
