import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, Users, Wallet } from "lucide-react";

const MobileNav = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      const headerElement = document.querySelector('header');
      const scrollY = window.scrollY;
      
      // Use optional chaining and type assertions to safely access offsetHeight
      const headerHeight = headerElement ? (headerElement as HTMLElement).offsetHeight : 0;
      
      if (scrollY > headerHeight) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed bottom-0 left-0 w-full bg-white border-t dark:bg-gray-900 dark:border-gray-800 z-50 ${isScrolled ? 'border-opacity-0' : ''}`}>
      <div className="container max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-4 gap-4 py-2">
          <Link to="/dashboard" className="flex flex-col items-center justify-center hover:text-[#2DAE75] dark:hover:text-[#2DAE75]">
            <Home className={`h-5 w-5 ${location.pathname === '/dashboard' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            <span className="text-xs">Home</span>
          </Link>
          <Link to="/create-group" className="flex flex-col items-center justify-center hover:text-[#2DAE75] dark:hover:text-[#2DAE75]">
            <PlusCircle className={`h-5 w-5 ${location.pathname === '/create-group' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            <span className="text-xs">Group</span>
          </Link>
          <Link to="/all-groups" className="flex flex-col items-center justify-center hover:text-[#2DAE75] dark:hover:text-[#2DAE75]">
            <Users className={`h-5 w-5 ${location.pathname === '/all-groups' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            <span className="text-xs">Groups</span>
          </Link>
          <Link to="/wallet-history" className="flex flex-col items-center justify-center hover:text-[#2DAE75] dark:hover:text-[#2DAE75]">
            <Wallet className={`h-5 w-5 ${location.pathname === '/wallet-history' ? 'text-[#2DAE75]' : 'text-gray-500 dark:text-gray-400'}`} />
            <span className="text-xs">Wallet</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default MobileNav;
