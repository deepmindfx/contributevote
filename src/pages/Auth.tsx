import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import "@/styles/auth.css";

export default function Auth() {
  const { isAuthenticated } = useSupabaseUser();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const mode = search.get("mode") === "signup" ? "signup" : "signin";
  const requestedDestination = location.state?.returnUrl || search.get("redirect");
  const destination = typeof requestedDestination === "string" && /^\/(?![/\\])/.test(requestedDestination)
    ? requestedDestination
    : "/dashboard";

  const changeMode = (nextMode: "signin" | "signup") => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (nextMode === "signup") next.set("mode", "signup");
      else next.delete("mode");
      return next;
    }, { replace: true, state: location.state });
  };

  if (isAuthenticated) return <Navigate to={destination} replace />;

  return (
    <div className="auth-layout">
      <header className="auth-header">
        <Link to="/" className="auth-brand"><CollectiPayMark size={34} /> CollectiPay</Link>
        <Link to="/" className="auth-back"><ArrowLeft size={15} aria-hidden="true" /> Back to home</Link>
      </header>
      <main className="auth-main">
        <section className="auth-entry" aria-labelledby="auth-title">
          <div className="auth-entry-inner">
            <h1 id="auth-title">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p>{mode === "signup" ? "Start a savings group or join one you’ve been invited to." : "Sign in to manage your wallet and groups."}</p>
            <AuthForm mode={mode} onModeChange={changeMode} />
          </div>
        </section>
        <aside className="auth-editorial" aria-label="CollectiPay group savings">
          <p>Save together.<br /><span>Decide together.</span></p>
        </aside>
      </main>
    </div>
  );
}
