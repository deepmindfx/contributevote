import { useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";
import Header from "@/components/layout/Header";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

export default function Auth() {
  const { isAuthenticated } = useSupabaseUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const mode = search.get("mode") === "signup" ? "signup" : "signin";
  const requestedDestination = location.state?.returnUrl || search.get("redirect");
  const destination = typeof requestedDestination === "string" && /^\/(?![/\\])/.test(requestedDestination)
    ? requestedDestination
    : "/dashboard";

  useEffect(() => {
    if (isAuthenticated) navigate(destination, { replace: true });
  }, [destination, isAuthenticated, navigate]);

  const changeMode = (nextMode: "signin" | "signup") => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (nextMode === "signup") next.set("mode", "signup");
      else next.delete("mode");
      return next;
    }, { replace: true, state: location.state });
  };

  return (
    <div className="min-h-dvh">
      <Header mobilePanel />
      <main className="app-page app-panel-page max-w-4xl items-start gap-6 md:grid md:grid-cols-[1fr_1.1fr]">
        <section className="app-panel-hero md:min-h-80" aria-labelledby="auth-title">
          <h1 id="auth-title" className="app-page-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="panel-kicker mt-3 max-w-xs leading-relaxed">
            {mode === "signup" ? "Start a savings group or join one with an invitation." : "Sign in to manage your wallet and savings groups."}
          </p>
        </section>
        <div className="app-panel-body md:pt-0">
          <AuthForm mode={mode} onModeChange={changeMode} />
          <Link to="/admin-login" className="mt-2 inline-flex min-h-11 items-center rounded text-sm font-medium text-muted-foreground hover:underline md:hidden">Admin sign in</Link>
        </div>
      </main>
    </div>
  );
}
