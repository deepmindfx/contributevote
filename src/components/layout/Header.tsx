
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { Moon, Sun, Bell, LogOut, User as UserIcon, Settings, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Header = () => {
  const { isAuthenticated } = useAuth();
  const { user, darkMode, toggleDarkMode, logout } = useApp();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  
  // Check if we're on a landing/auth page or app page
  const isLandingOrAuthPage = location.pathname === "/" || location.pathname === "/auth";
  
  // Calculate unread notifications count
  const unreadNotificationsCount = user?.notifications?.filter((n: any) => !n.read)?.length || 0;
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  const handleToggleTheme = () => {
    toggleDarkMode();
  };
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };
  
  const userInitials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  return (
    <header 
      ref={headerRef}
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled 
          ? 'bg-background/90 backdrop-blur-md border-b'
          : isLandingOrAuthPage 
            ? 'bg-transparent' 
            : 'bg-background'
      }`}
    >
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-green-400 text-transparent bg-clip-text">
              CollectiPay
            </span>
          </Link>
          
          {isAuthenticated && (
            <nav className="ml-8 hidden md:flex gap-6">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link to="/groups" className="text-muted-foreground hover:text-foreground transition-colors">
                Groups
              </Link>
              <Link to="/create-group" className="text-muted-foreground hover:text-foreground transition-colors">
                Create Group
              </Link>
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleToggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          
          {isAuthenticated && user ? (
            <>
              <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell size={20} />
                    {unreadNotificationsCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-primary text-white" 
                        variant="secondary"
                      >
                        {unreadNotificationsCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Notifications</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {user.notifications && user.notifications.length > 0 ? (
                      user.notifications.map((notification: any) => (
                        <div key={notification.id} className="p-3 border-b">
                          <p className="text-sm">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.createdAt && new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No notifications yet
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 flex items-center gap-2 pl-3 pr-1 py-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar || ""} alt={user.name} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link to="/auth">Login</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/auth?signup=true">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
