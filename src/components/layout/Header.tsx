import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { 
  Wallet, 
  Menu, 
  X, 
  LogOut, 
  User, 
  Settings, 
  Bell, 
  Moon,
  Sun,
  ShieldCheck,
  BellDot
} from "lucide-react";
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/services/localStorage";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const Header = () => {
  const { user, isAuthenticated, isAdmin, logout, updateProfile, refreshData } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const popoverTriggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  const toggleDarkMode = () => {
    if (user && user.id) {
      const newPreferences = {
        ...user.preferences,
        darkMode: !user.preferences?.darkMode
      };
      
      updateProfile({ preferences: newPreferences });
      toast.success(`${newPreferences.darkMode ? 'Dark' : 'Light'} mode enabled`);
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  useEffect(() => {
    // Close mobile menu when route changes
    setIsMenuOpen(false);
  }, [location]);
  
  const NavLink = ({ href, children, disabled = false }: NavLinkProps) => (
    <Link 
      to={disabled ? '#' : href} 
      className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
        location.pathname === href 
          ? 'text-primary' 
          : 'text-muted-foreground hover:text-foreground'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={disabled ? (e) => e.preventDefault() : undefined}
    >
      {children}
    </Link>
  );
  
  const handleNotificationRead = (id: string, relatedId?: string) => {
    markNotificationAsRead(id);
    refreshData();

    // If notification is related to a contribution, navigate to it
    if (relatedId) {
      const isContribution = user.contributions?.some(c => c.id === relatedId);
      if (isContribution) {
        setNotificationsOpen(false);
        navigate(`/groups/${relatedId}`);
      }
    }
  };
  
  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(user?.id);
    refreshData();
    toast.success("All notifications marked as read");
  };
  
  const unreadNotifications = user?.notifications?.filter(n => !n.read).length || 0;
  
  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-200 ${
        scrolled ? 'bg-background/95 backdrop-blur-lg shadow-sm' : 'bg-background'
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="rounded-full bg-green-100 p-1.5 w-8 h-8 flex items-center justify-center">
            <img 
              src="/lovable-uploads/e42496b1-7582-432a-8a35-d596e573ab7d.png" 
              alt="CollectiPay Logo" 
              className="w-6 h-6"
            />
          </div>
          {isAuthenticated && user?.firstName ? (
            <span className="font-medium text-lg">Hi, {user.firstName}</span>
          ) : (
            <span className="font-bold text-xl">CollectiPay</span>
          )}
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {isAuthenticated ? (
            <>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavLink href="/dashboard">Dashboard</NavLink>
                  </NavigationMenuItem>
                  
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Groups</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-3 p-6 w-[400px]">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              to="/dashboard"
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            >
                              <div className="text-sm font-medium leading-none">My Groups</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                View all your contribution groups
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <Link
                              to="/create-group"
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            >
                              <div className="text-sm font-medium leading-none">Create New Group</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                Start a new contribution group
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  
                  {isAdmin && (
                    <NavigationMenuItem>
                      <NavLink href="/admin">Admin</NavLink>
                    </NavigationMenuItem>
                  )}
                </NavigationMenuList>
              </NavigationMenu>
              
              <div className="flex items-center ml-4 space-x-3">
                <Popover 
                  open={notificationsOpen} 
                  onOpenChange={setNotificationsOpen}
                >
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="relative p-2"
                      ref={popoverTriggerRef}
                    >
                      {unreadNotifications > 0 ? (
                        <BellDot className="h-5 w-5" />
                      ) : (
                        <Bell className="h-5 w-5" />
                      )}
                      {unreadNotifications > 0 && (
                        <Badge 
                          className="absolute -top-1 -right-1 px-1 min-w-[18px] h-[18px] flex items-center justify-center"
                          variant="destructive"
                        >
                          {unreadNotifications}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="flex items-center justify-between p-4 border-b">
                      <h4 className="font-semibold">Notifications</h4>
                      {user?.notifications && user.notifications.length > 0 && 
                        <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                          Mark all read
                        </Button>
                      }
                    </div>
                    <ScrollArea className="h-[400px]">
                      {!user?.notifications || user.notifications.length === 0 ? 
                        <div className="p-4 text-center text-muted-foreground">
                          <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                          <p>No notifications</p>
                        </div> 
                        : 
                        user.notifications.map(notification => 
                          <div 
                            key={notification.id} 
                            className={`p-4 border-b last:border-b-0 ${!notification.read ? 'bg-muted/50' : ''} 
                              hover:bg-muted/30 cursor-pointer transition-colors`} 
                            onClick={() => handleNotificationRead(notification.id, notification.relatedId)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`rounded-full w-2 h-2 mt-1.5 ${!notification.read ? 'bg-green-600' : 'bg-transparent'}`} />
                              <div className="flex-1">
                                <p className="text-sm">{notification.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {notification.createdAt && format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                                </p>
                              </div>
                              {notification.read && 
                                <div className="text-muted-foreground opacity-50">
                                  <X className="h-3 w-3" />
                                </div>
                              }
                            </div>
                          </div>
                        )
                      }
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="p-2"
                  onClick={toggleDarkMode}
                >
                  {user?.preferences?.darkMode ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 cursor-pointer">
                      <AvatarImage src={user.profileImage} alt={user.name} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Admin</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <>
              <NavLink href="/">Home</NavLink>
              <NavLink href="/auth">Login / Register</NavLink>
              <NavLink href="/admin-login">Admin Login</NavLink>
            </>
          )}
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center space-x-3">
          {isAuthenticated && (
            <>
              <Popover 
                open={notificationsOpen} 
                onOpenChange={setNotificationsOpen}
              >
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="relative p-2"
                    ref={popoverTriggerRef}
                  >
                    {unreadNotifications > 0 ? (
                      <BellDot className="h-5 w-5" />
                    ) : (
                      <Bell className="h-5 w-5" />
                    )}
                    {unreadNotifications > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 px-1 min-w-[18px] h-[18px] flex items-center justify-center"
                        variant="destructive"
                      >
                        {unreadNotifications}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold">Notifications</h4>
                    {user?.notifications && user.notifications.length > 0 && 
                      <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                        Mark all read
                      </Button>
                    }
                  </div>
                  <ScrollArea className="h-[400px]">
                    {!user?.notifications || user.notifications.length === 0 ? 
                      <div className="p-4 text-center text-muted-foreground">
                        <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No notifications</p>
                      </div> 
                      : 
                      user.notifications.map(notification => 
                        <div 
                          key={notification.id} 
                          className={`p-4 border-b last:border-b-0 ${!notification.read ? 'bg-muted/50' : ''} 
                            hover:bg-muted/30 cursor-pointer transition-colors`} 
                          onClick={() => handleNotificationRead(notification.id, notification.relatedId)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`rounded-full w-2 h-2 mt-1.5 ${!notification.read ? 'bg-green-600' : 'bg-transparent'}`} />
                            <div className="flex-1">
                              <p className="text-sm">{notification.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {notification.createdAt && format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                              </p>
                            </div>
                            {notification.read && 
                              <div className="text-muted-foreground opacity-50">
                                <X className="h-3 w-3" />
                              </div>
                            }
                          </div>
                        </div>
                      )
                    }
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="p-2"
                onClick={toggleDarkMode}
              >
                {user?.preferences?.darkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-background border-t">
          <div className="container mx-auto py-4 px-4 space-y-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-md">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profileImage} alt={user.name} />
                    <AvatarFallback>
                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ₦{user.walletBalance?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Link 
                    to="/dashboard" 
                    className="block p-3 rounded-md hover:bg-accent"
                  >
                    Dashboard
                  </Link>
                  
                  <Link 
                    to="/profile" 
                    className="block p-3 rounded-md hover:bg-accent"
                  >
                    Profile
                  </Link>
                  
                  <Link 
                    to="/settings" 
                    className="block p-3 rounded-md hover:bg-accent"
                  >
                    Settings
                  </Link>
                  
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      className="block p-3 rounded-md hover:bg-accent"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Link 
                  to="/" 
                  className="block p-3 rounded-md hover:bg-accent"
                >
                  Home
                </Link>
                
                <Link 
                  to="/auth" 
                  className="block p-3 rounded-md hover:bg-accent"
                >
                  Login / Register
                </Link>
                
                <Link 
                  to="/admin-login" 
                  className="block p-3 rounded-md hover:bg-accent"
                >
                  Admin Login
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
