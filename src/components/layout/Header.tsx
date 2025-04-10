
import { useState, useEffect } from "react";
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
  ShieldCheck
} from "lucide-react";
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
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

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const Header = () => {
  const { user, isAuthenticated, isAdmin, logout, updateProfile } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
  
  // Safely handle notifications
  const unreadNotifications = user?.notifications?.filter(n => !n.read)?.length || 0;
  
  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-background/80 backdrop-blur-lg shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="rounded-md bg-primary p-1.5">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">CollectiPay</span>
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="relative p-2"
                  onClick={() => navigate('/profile')}
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 px-1 min-w-[18px] h-[18px] flex items-center justify-center"
                      variant="destructive"
                    >
                      {unreadNotifications}
                    </Badge>
                  )}
                </Button>
                
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
                      <AvatarImage src={user?.profileImage} alt={user?.name || "User"} />
                      <AvatarFallback>
                        {user?.firstName?.charAt(0) || ""}{user?.lastName?.charAt(0) || ""}
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative p-2"
                onClick={() => navigate('/profile')}
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 px-1 min-w-[18px] h-[18px] flex items-center justify-center"
                    variant="destructive"
                  >
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
              
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
                    <AvatarImage src={user?.profileImage} alt={user?.name || "User"} />
                    <AvatarFallback>
                      {user?.firstName?.charAt(0) || ""}{user?.lastName?.charAt(0) || ""}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.name || "User"}</p>
                    <p className="text-sm text-muted-foreground">
                      Balance: ₦{user?.walletBalance?.toLocaleString() || 0}
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
