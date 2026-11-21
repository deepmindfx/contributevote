import AuthForm from "@/components/auth/AuthForm";
import Header from "@/components/layout/Header";
import { useEffect } from "react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { Link, useNavigate } from "react-router-dom";
import { Users, Vote, Wallet } from "lucide-react";

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
      <main className="app-page max-w-md lg:max-w-5xl">
        <div className="grid items-stretch gap-8 lg:grid-cols-[1.1fr_1fr]">
          <aside className="wallet-overview hidden flex-col justify-between rounded-[1.6rem] p-8 lg:flex">
            <p className="max-w-xs text-[2.5rem] font-semibold leading-[1.08] tracking-[-.06em]">Save together.<br />Decide together.</p>
            <ul className="space-y-3 pt-12 text-sm font-medium text-white/90">
              <li className="flex items-center gap-3"><Users size={19} aria-hidden="true" /> Create or join a contribution group</li>
              <li className="flex items-center gap-3"><Wallet size={19} aria-hidden="true" /> Track payments and funding progress</li>
              <li className="flex items-center gap-3"><Vote size={19} aria-hidden="true" /> Vote on how group funds are used</li>
            </ul>
          </aside>
          <section className="min-w-0 lg:py-6" aria-labelledby="auth-heading">
            <h1 id="auth-heading" className="app-page-title mb-5">Welcome to CollectiPay</h1>
            <AuthForm />
            <Link to="/admin-login" className="mt-3 inline-flex min-h-11 items-center rounded text-sm font-medium text-muted-foreground hover:underline">
              Admin sign in
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Auth;
