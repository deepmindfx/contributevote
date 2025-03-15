
import { Link, useLocation } from "react-router-dom";
import { Home, Plus, Users, User } from "lucide-react";

const MobileNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

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
          to="/groups"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive("/groups")
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
          to="/votes"
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive("/votes")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m9 12 2 2 4-4" />
            <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
            <path d="M22 19H2" />
          </svg>
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
