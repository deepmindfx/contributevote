
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Wallet, VoteIcon, Users, Settings, ArrowLeft } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useState, useEffect } from "react";

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSupabaseUser();
  
  const [pendingVotes, setPendingVotes] = useState<any[]>([]);
  const [showBackButton, setShowBackButton] = useState(false);
  
  // TODO: Implement pending votes with Supabase
  useEffect(() => {
    if (!user?.id) return;
    
    // For now, set empty array - will implement with Supabase withdrawal requests
    setPendingVotes([]);
  }, [user]);

  // Determine if back button should be shown based on current route
  useEffect(() => {
    setShowBackButton(location.pathname === '/settings' || location.pathname === '/profile');
  }, [location.pathname]);

  // Handle back button click
  const handleBackClick = () => {
    navigate(-1);
  };

  // Fix for mobile nav disappearing - force a repaint on route change
  useEffect(() => {
    const nav = document.querySelector('.mobile-nav') as HTMLElement;
    if (nav) {
      // Force a repaint by getting offsetHeight
      nav.offsetHeight;
    }
  }, [location.pathname]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 md:hidden mobile-nav">
      {showBackButton ? (
        <div className="flex items-center justify-between p-4">
          <button
            onClick={handleBackClick}
            className="flex items-center text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>Back</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-around">
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center py-3 px-2 ${
              location.pathname === "/dashboard" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          
          <Link 
            to="/wallet-history" 
            className={`flex flex-col items-center py-3 px-2 ${
              location.pathname === "/wallet-history" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
            aria-label="Wallet"
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs mt-1">Wallet</span>
          </Link>
          
          <Link 
            to="/votes" 
            className={`flex flex-col items-center py-3 px-2 relative ${
              location.pathname === "/votes" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
            aria-label="Votes"
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
            aria-label="Groups"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs mt-1">Groups</span>
          </Link>
          
          <Link 
            to="/settings" 
            className={`flex flex-col items-center py-3 px-2 ${
              location.pathname === "/settings" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default MobileNav;
