
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white dark:from-green-950 dark:to-black">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold mb-4 text-green-600">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
          Oops! The page you're looking for doesn't exist
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page at <span className="font-mono text-green-600">{location.pathname}</span> could not be found
        </p>
        <Button asChild className="bg-green-600 hover:bg-green-700">
          <Link to="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
