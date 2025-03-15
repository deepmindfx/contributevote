
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, Wallet, LogOut, Settings, User as UserIcon, MessageSquare } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { logoutUser } from "@/services/localStorage";
import { toast } from "sonner";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const { user, isAdmin, refreshData } = useApp();
  const navigate = useNavigate();
  const isLoggedIn = !!user?.id;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logoutUser();
    refreshData();
    toast.success("You have been logged out successfully");
    navigate("/auth");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 py-3 px-4 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-lg shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">CollectiPay</span>
        </Link>

        {isLoggedIn ? (
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => navigate("/settings")}
            >
              <Bell className="h-5 w-5" />
              {user.notifications && user.notifications.length > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                  {user.notifications.filter(n => !n.read).length}
                </span>
              )}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer">
                  <AvatarImage src={user.profileImage || ""} alt={user.name} />
                  <AvatarFallback>
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
                  </AvatarFallback>
                </Avatar>
              </SheetTrigger>
              <SheetContent>
                <div className="px-4 py-6 space-y-6">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.profileImage || ""} alt={user.name} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/dashboard">Dashboard</Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/create-group">Create Group</Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/settings">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Profile Settings
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </Button>
                    
                    {isAdmin && (
                      <Button variant="ghost" className="w-full justify-start" asChild>
                        <Link to="/admin">Admin Dashboard</Link>
                      </Button>
                    )}
                  </div>
                  
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex space-x-2">
              <Button variant="ghost" asChild>
                <Link to="/auth">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col space-y-4 pt-6">
                  <Button asChild>
                    <Link to="/auth">Get Started</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/auth">Login</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
