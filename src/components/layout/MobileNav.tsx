
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Plus, Users, User, CheckSquare } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useApp();
  
  const isActive = (path: string) => location.pathname === path;
  const isPathActive = (path: string) => location.pathname.includes(path);

  // Don't show the mobile nav for admin pages or when not authenticated
  if (isAdmin && location.pathname.includes('/admin')) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex justify-around items-center h-16">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive("/dashboard")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isPathActive("/groups")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-xs mt-1">Groups</span>
        </Link>
        
        <Link
          to="/create-group"
          className="flex flex-col items-center justify-center w-full h-full transition-colors text-primary"
        >
          <div className="rounded-full bg-primary p-3 -mt-8 text-primary-foreground shadow-lg">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-xs mt-1">Create</span>
        </Link>
        
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isPathActive("/votes")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="h-5 w-5" />
          <span className="text-xs mt-1">Votes</span>
        </Link>
        
        <Link
          to="/profile"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive("/profile")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-5 w-5" />
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileNav;
