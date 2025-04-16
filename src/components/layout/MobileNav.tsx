
import { Link, useLocation } from "react-router-dom";
import { Activity, Home, Settings, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";

const MobileNav = () => {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  
  // Fix for disappearing icons - force a repaint when route changes
  useEffect(() => {
    const forceRepaint = () => {
      if (navRef.current) {
        // Multiple techniques to force a repaint
        // 1. Force a layout calculation and repaint
        const height = navRef.current.getBoundingClientRect().height;
        
        // 2. Add and remove a class to force redraw
        navRef.current.classList.add('force-repaint');
        setTimeout(() => {
          if (navRef.current) {
            navRef.current.classList.remove('force-repaint');
          }
        }, 10);
        
        // 3. Apply and remove a transform
        navRef.current.style.transform = 'translateZ(0)';
        setTimeout(() => {
          if (navRef.current) {
            navRef.current.style.transform = '';
          }
        }, 10);
      }
    };
    
    // Call immediately when route changes
    forceRepaint();
    
    // Also add click and scroll listeners to catch other cases
    const handleEvent = () => forceRepaint();
    
    window.addEventListener('scroll', handleEvent);
    window.addEventListener('click', handleEvent);
    window.addEventListener('touchstart', handleEvent);
    
    return () => {
      window.removeEventListener('scroll', handleEvent);
      window.removeEventListener('click', handleEvent);
      window.removeEventListener('touchstart', handleEvent);
    };
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
