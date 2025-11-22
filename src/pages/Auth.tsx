import AuthForm from "@/components/auth/AuthForm";
import Header from "@/components/layout/Header";
import { useEffect } from "react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const { isAuthenticated } = useSupabaseUser();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
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