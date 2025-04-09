
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Wallet, VoteIcon, Users, Settings } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useEffect } from "react";

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { withdrawalRequests, user } = useApp();
  
  // Check if there are any pending votes for the current user
  const pendingVotes = withdrawalRequests.filter(request => 
    request.status === 'pending' && 
    !request.votes.some(vote => vote.userId === user.id)
  );

  // Ensure each route exists and can be navigated to properly
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 md:hidden">
      <div className="flex items-center justify-around">
        <Link 
          to="/dashboard" 
          className={`flex flex-col items-center py-3 px-2 ${
            location.pathname === "/dashboard" ? "text-[#2DAE75]" : "text-muted-foreground"
          }`}
          onClick={() => handleNavigation("/dashboard")}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        
        <Link 
          to="/wallet-history" 
          className={`flex flex-col items-center py-3 px-2 ${
            location.pathname === "/wallet-history" ? "text-[#2DAE75]" : "text-muted-foreground"
          }`}
          onClick={() => handleNavigation("/wallet-history")}
        >
          <Wallet className="h-5 w-5" />
          <span className="text-xs mt-1">Wallet</span>
        </Link>
        
        <Link 
          to="/votes" 
          className={`flex flex-col items-center py-3 px-2 relative ${
            location.pathname === "/votes" ? "text-[#2DAE75]" : "text-muted-foreground"
          }`}
          onClick={() => handleNavigation("/votes")}
        >
          <VoteIcon className="h-5 w-5" />
          {pendingVotes.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {pendingVotes.length > 9 ? '9+' : pendingVotes.length}
            </span>
          )}
          <span className="text-xs mt-1">Votes</span>
        </Link>
        
        <Link 
          to="/all-groups" 
          className={`flex flex-col items-center py-3 px-2 ${
            location.pathname === "/all-groups" ? "text-[#2DAE75]" : "text-muted-foreground"
          }`}
          onClick={() => handleNavigation("/all-groups")}
        >
          <Users className="h-5 w-5" />
          <span className="text-xs mt-1">Groups</span>
        </Link>
        
        <Link 
          to="/settings" 
          className={`flex flex-col items-center py-3 px-2 ${
            location.pathname === "/settings" ? "text-[#2DAE75]" : "text-muted-foreground"
          }`}
          onClick={() => handleNavigation("/settings")}
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs mt-1">Settings</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileNav;
