import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Plus, User, Bell } from 'lucide-react';
import { useApp } from "@/contexts/AppContext";

const MobileNav = () => {
  const location = useLocation();
  const { user, hasUnreadNotifications } = useApp();
  const [isLabelVisible, setIsLabelVisible] = useState(false);

  useEffect(() => {
    const checkLabelVisibility = () => {
      const mobileNavElement = document.querySelector('.mobile-nav');
      if (mobileNavElement && mobileNavElement instanceof HTMLElement) {
        const height = mobileNavElement.offsetHeight;
        setIsLabelVisible(height > 60);
      }
    };

    checkLabelVisibility();
    window.addEventListener('resize', checkLabelVisibility);
    return () => window.removeEventListener('resize', checkLabelVisibility);
  }, []);

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700 z-50">
      <ul className="flex justify-around items-center p-4">
        <li>
          <Link to="/dashboard" className="flex flex-col items-center justify-center">
            <Home className={`h-5 w-5 ${location.pathname === '/dashboard' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            {isLabelVisible && <span className={`text-xs ${location.pathname === '/dashboard' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`}>Home</span>}
          </Link>
        </li>
        <li>
          <Link to="/contributions/new" className="flex flex-col items-center justify-center">
            <Plus className={`h-5 w-5 ${location.pathname === '/contributions/new' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            {isLabelVisible && <span className={`text-xs ${location.pathname === '/contributions/new' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`}>Create</span>}
          </Link>
        </li>
        <li>
          <Link to={`/profile/${user?.id}`} className="flex flex-col items-center justify-center">
            <User className={`h-5 w-5 ${location.pathname === `/profile/${user?.id}` ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            {isLabelVisible && <span className={`text-xs ${location.pathname === `/profile/${user?.id}` ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`}>Profile</span>}
          </Link>
        </li>
        <li>
          <Link to="/notifications" className="flex flex-col items-center justify-center relative">
            <Bell className={`h-5 w-5 ${location.pathname === '/notifications' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            {hasUnreadNotifications && (
              <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full w-2 h-2"></span>
            )}
            {isLabelVisible && <span className={`text-xs ${location.pathname === '/notifications' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`}>Notifications</span>}
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default MobileNav;
