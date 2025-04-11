
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";
import Header from "@/components/layout/Header";
import { useApp } from "@/contexts/AppContext";

const Auth = () => {
  const { isAuthenticated } = useApp();
  const navigate = useNavigate();
  
  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      console.log("User is authenticated, navigating to dashboard");
      // Use replace: true to prevent back button from returning to login
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-32">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Welcome to CollectiPay</h2>
            <p className="text-muted-foreground mt-2">
              Secure login for your group contribution platform
            </p>
          </div>
          <AuthForm />
        </div>
      </div>
    </div>
  );
};

export default Auth;
