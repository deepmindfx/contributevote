
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Wallet, VoteIcon, Users, Settings, ArrowLeft, Send } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { withdrawalRequests, user } = useApp();
  const [showBackButton, setShowBackButton] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  
  // Check if there are any pending votes for the current user
  const pendingVotes = withdrawalRequests.filter(request => 
    request.status === 'pending' && 
    !request.votes.some(vote => vote.userId === user.id)
  );

  // Determine if back button should be shown based on current route
  useEffect(() => {
    setShowBackButton(location.pathname === '/settings');
  }, [location.pathname]);

  // Determine if wallet menu should be shown
  useEffect(() => {
    setShowWalletMenu(location.pathname === '/wallet-history' || location.pathname === '/send-money');
  }, [location.pathname]);

  // Handle back button click
  const handleBackClick = () => {
    navigate(-1);
  };

  // Ensure each route exists and can be navigated to properly
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 md:hidden">
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
          >
            <Home className="h-5 w-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          
          {showWalletMenu ? (
            <div className="flex flex-col items-center py-3 px-2 relative text-[#2DAE75]">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center focus:outline-none">
                    <Wallet className="h-5 w-5" />
                    <span className="text-xs mt-1">Wallet</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/wallet-history")}>
                    Wallet History
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/send-money")}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Money
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link 
              to="/wallet-history" 
              className={`flex flex-col items-center py-3 px-2 ${
                location.pathname === "/wallet-history" ? "text-[#2DAE75]" : "text-muted-foreground"
              }`}
            >
              <Wallet className="h-5 w-5" />
              <span className="text-xs mt-1">Wallet</span>
            </Link>
          )}
          
          <Link 
            to="/votes" 
            className={`flex flex-col items-center py-3 px-2 relative ${
              location.pathname === "/votes" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
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
          >
            <Users className="h-5 w-5" />
            <span className="text-xs mt-1">Groups</span>
          </Link>
          
          <Link 
            to="/settings" 
            className={`flex flex-col items-center py-3 px-2 ${
              location.pathname === "/settings" ? "text-[#2DAE75]" : "text-muted-foreground"
            }`}
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
