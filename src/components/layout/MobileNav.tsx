
import { Link, useLocation } from "react-router-dom";
import { Activity, Home, Settings, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";

const MobileNav = () => {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  
  // Fix for disappearing icons - force a repaint when route changes
  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        // Force a repaint by accessing a layout property
        // This triggers a recalculation which fixes the disappearing icons
        const height = navRef.current.getBoundingClientRect().height;
        navRef.current.style.transform = 'translateZ(0)';
        setTimeout(() => {
          if (navRef.current) {
            navRef.current.style.transform = '';
          }
        }, 0);
      }
    };
    
    // Call once on route change
    handleScroll();
    
    // Also listen to scroll events which can cause rendering issues
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  return (
    <div 
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 md:hidden z-50"
    >
      <div className="grid grid-cols-4 h-full">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center justify-center ${
            location.pathname === "/dashboard" ? "text-[#2DAE75]" : "text-gray-500"
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link
          to="/activity"
          className={`flex flex-col items-center justify-center ${
            location.pathname === "/activity" ? "text-[#2DAE75]" : "text-gray-500"
          }`}
        >
          <Activity className="h-5 w-5" />
          <span className="text-xs mt-1">Activity</span>
        </Link>
        <Link
          to="/wallet"
          className={`flex flex-col items-center justify-center ${
            location.pathname === "/wallet" ? "text-[#2DAE75]" : "text-gray-500"
          }`}
        >
          <Wallet className="h-5 w-5" />
          <span className="text-xs mt-1">Wallet</span>
        </Link>
        <Link
          to="/settings"
          className={`flex flex-col items-center justify-center ${
            location.pathname === "/settings" ? "text-[#2DAE75]" : "text-gray-500"
          }`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs mt-1">Settings</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileNav;
