import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { hasStoredSupabaseSession } from "@/integrations/supabase/client";
import "@/styles/auth.css";

export default function Auth() {
  const { isAuthenticated, loading, sessionUnavailable, retrySession, logout } = useSupabaseUser();
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

  const checkingExistingSession = loading && hasStoredSupabaseSession();

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
            {checkingExistingSession && (
              <div
                role="status"
                className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-accent/50 px-3.5 py-2.5 text-xs text-foreground"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <RefreshCw size={13} className="animate-spin text-primary" aria-hidden="true" />
                  Checking your previous session…
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            {sessionUnavailable && !checkingExistingSession && (
              <div
                role="status"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-foreground"
              >
                <span>Previous session couldn’t be restored. Sign in below to continue.</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void retrySession()}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
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
