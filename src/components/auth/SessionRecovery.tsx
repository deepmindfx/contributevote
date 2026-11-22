import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

export function SessionRecovery() {
  const { retrySession, logout } = useSupabaseUser();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleRetry = async () => {
    if (retrying || signingOut) return;
    setRetrying(true);
    try {
      await retrySession();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate("/auth", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-5 py-12">
      <section className="w-full space-y-4 rounded-3xl border bg-card p-6 shadow-sm" aria-labelledby="session-heading">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary">
          <ShieldAlert size={21} aria-hidden="true" />
        </span>
        <div>
          <h1 id="session-heading" className="text-xl font-semibold tracking-tight">Reconnect to CollectiPay</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We couldn’t load your account. Try again to continue where you left off, or sign out to log in freshly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={retrying || signingOut} onClick={() => void handleRetry()}>
            <RefreshCw size={15} className={retrying ? "animate-spin" : undefined} aria-hidden="true" />
            {retrying ? "Reconnecting…" : "Try again"}
          </Button>
          <Button variant="ghost" disabled={signingOut} onClick={() => void handleSignOut()}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </section>
    </main>
  );
}
