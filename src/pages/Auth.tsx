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
      <main className="app-page max-w-md">
        <h1 className="app-page-title mb-6">Welcome to CollectiPay</h1>
        <AuthForm />
      </main>
    </div>
  );
};

export default Auth;
