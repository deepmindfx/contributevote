import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Vote,
  Wallet,
  Zap,
} from "lucide-react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";
import { CollectiPayMark } from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { hasStoredSupabaseSession } from "@/integrations/supabase/client";
import { safeReturnPath } from "@/lib/safeReturnPath";
import "@/styles/auth.css";

const FEATURE_CARDS = [
  {
    icon: Wallet,
    tone: "mint",
    title: "Dedicated NGN wallets",
    description:
      "Receive instant bank deposits into your personal wallet or shared group virtual accounts.",
  },
  {
    icon: Vote,
    tone: "purple",
    title: "Democratic payout voting",
    description:
      "70% voter turnout and 60% approval are recorded transparently before group funds move.",
  },
  {
    icon: Zap,
    tone: "sky",
    title: "Instant bank & bulk transfers",
    description:
      "Send to any Nigerian bank in one tap or pay teams in bulk with a single transaction PIN.",
  },
  {
    icon: ShieldCheck,
    tone: "slate",
    title: "Ice Vault & 0% charity fees",
    description:
      "Lock personal target savings until maturity and keep 0% CollectiPay fee on charity pools.",
  },
] as const;

export default function Auth() {
  const { isAuthenticated, loading, sessionUnavailable, retrySession, logout } = useSupabaseUser();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const mode = search.get("mode") === "signup" ? "signup" : "signin";
  const requestedDestination = location.state?.returnUrl || search.get("redirect");
  const destination = safeReturnPath(requestedDestination, window.location.origin) ?? "/dashboard";

  const changeMode = (nextMode: "signin" | "signup") => {
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (nextMode === "signup") next.set("mode", "signup");
        else next.delete("mode");
        return next;
      },
      { replace: true, state: location.state }
    );
  };

  if (isAuthenticated) return <Navigate to={destination} replace />;

  const checkingExistingSession = loading && hasStoredSupabaseSession();

  return (
    <div className="cb-auth-shell">
      {/* Desktop Left Pure-White Editorial Branding Panel (54%) */}
      <aside className="cb-auth-aside" aria-label="CollectiPay overview">
        <div className="cb-auth-aside-top">
          <Link to="/" className="cb-auth-back-link">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to home</span>
          </Link>
        </div>

        <div className="cb-auth-aside-center">
          <div key={mode} className="cb-auth-hero-heading">
            <h1>{mode === "signup" ? "Start saving together" : "Welcome back"}</h1>
            <p>
              {mode === "signup"
                ? "Join families, faith communities, cooperatives, and teams pooling Naira transparently with CollectiPay."
                : "Log in to manage your NGN wallet, track shared community pools, vote on withdrawals, and send instant transfers."}
            </p>
          </div>

          <div className="cb-auth-features">
            {FEATURE_CARDS.map(({ icon: Icon, tone, title, description }) => (
              <div key={title} className="cb-auth-feature-card">
                <span className={`cb-auth-feature-icon cb-auth-feature-icon--${tone}`} aria-hidden="true">
                  <Icon size={17} strokeWidth={2.1} />
                </span>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="cb-auth-copyright">
          © {new Date().getFullYear()} CollectiPay. All rights reserved.
        </p>
      </aside>

      {/* Right Canvas (Desktop 46%) & Centered Floating Card (Mobile + Desktop) */}
      <main className="cb-auth-main">
        <section className="cb-auth-card" aria-labelledby="auth-title">
          <div className="cb-auth-card-brand">
            <Link to="/" className="cb-auth-brand-link" aria-label="CollectiPay home">
              <CollectiPayMark size={30} />
              <span className="cb-auth-brand-text">
                collectipay<sup aria-hidden="true">®</sup>
              </span>
            </Link>
          </div>

          <div key={mode} className="cb-auth-card-head">
            <h2 id="auth-title">
              {mode === "signup" ? "Create your account" : "Sign in to CollectiPay"}
            </h2>
            <p>
              {mode === "signup"
                ? "Enter your details to start pooling and saving together."
                : "Access your wallet and manage your groups."}
            </p>
          </div>

          <div className="cb-auth-card-body">
            {checkingExistingSession && (
              <div
                role="status"
                className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50 px-3.5 py-2.5 text-xs text-[#0f172a]"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <RefreshCw size={13} className="animate-spin text-[#059669]" aria-hidden="true" />
                  Checking your previous session…
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="shrink-0 font-semibold text-[#059669] underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {sessionUnavailable && !checkingExistingSession && (
              <div
                role="status"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs text-[#0f172a]"
              >
                <span>Previous session couldn’t be restored. Sign in below to continue.</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void retrySession()}
                    className="font-semibold text-[#059669] underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="font-semibold text-[#64748b] underline-offset-2 hover:text-[#0f172a] hover:underline"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            <AuthForm mode={mode} onModeChange={changeMode} />
          </div>

          <footer className="cb-auth-card-footer">
            Questions about fees, BVN, or voting?{" "}
            <Link to="/faq">Help Center &amp; FAQ</Link> ·{" "}
            <Link to="/terms/ice-vault/v1">Terms</Link>
          </footer>
        </section>

        <Link to="/" className="cb-auth-mobile-back">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </main>
    </div>
  );
}
