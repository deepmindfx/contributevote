import { useState, type FormEvent } from "react";
import { Compass, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import {
  meetsPasswordRequirements,
  PASSWORD_MIN_LENGTH,
  passwordIssue,
} from "@/lib/passwordPolicy";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { normalizeSignupPhone, SIGNUP_PHONE_ERROR } from "@/lib/signupPhone";

type AuthMode = "signin" | "signup";

function PasswordField({
  id,
  value,
  onChange,
  creating = false,
  onForgotClick,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  creating?: boolean;
  onForgotClick?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="cb-auth-label">
          Password
        </Label>
        {!creating && onForgotClick && (
          <button
            type="button"
            onClick={onForgotClick}
            className="cb-auth-forgot"
          >
            Forgot password?
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          placeholder={creating ? "Create a strong password" : "Your password"}
          required
          minLength={creating ? PASSWORD_MIN_LENGTH : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="cb-auth-input pr-11"
          aria-describedby={creating ? id + "-hint" : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#94a3b8] transition-colors hover:text-[#334155]"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>

      {creating && <PasswordRequirements id={id + "-hint"} password={value} />}
    </div>
  );
}

export default function AuthForm({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { signIn, signUp } = useSupabaseUser();
  const [login, setLogin] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");

  // Forgot password modal state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    if (pending || nextMode === mode) return;
    setErrorMessage("");
    setRegistrationEmail("");
    onModeChange(nextMode);
  };

  const openForgotModal = () => {
    setResetEmail(login.email.trim());
    setResetOpen(true);
  };

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetEmail = resetEmail.trim();
    if (!targetEmail || resetPending) return;
    setResetPending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast.error(error.message || "Could not send password reset link.");
      } else {
        toast.success(`Password reset link sent to ${targetEmail}`);
        setResetOpen(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send password reset link."
      );
    } finally {
      setResetPending(false);
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const issue = mode === "signup" ? passwordIssue(registration.password) : undefined;
    if (issue) {
      setErrorMessage(issue);
      return;
    }

    setPending(true);
    setErrorMessage("");

    try {
      if (mode === "signup") {
        const name = registration.name.trim();
        if (!name) {
          setErrorMessage("Enter your full name.");
          return;
        }
        const phone = normalizeSignupPhone(registration.phone);
        if (!phone) {
          setErrorMessage(SIGNUP_PHONE_ERROR);
          return;
        }
        const { error } = await signUp(registration.email, registration.password, {
          name,
          phone,
        });
        if (error) setErrorMessage(error.message || "Registration failed.");
        else setRegistrationEmail(registration.email.trim());
      } else {
        const { error } = await signIn(login.email, login.password);
        if (error) setErrorMessage(error.message || "Sign-in failed.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {mode === "signin" ? (
        <div>
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="cb-auth-label">
                Email address
              </Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={login.email}
                onChange={(event) => setLogin({ ...login, email: event.target.value })}
                className="cb-auth-input"
              />
            </div>

            <PasswordField
              id="login-password"
              value={login.password}
              onChange={(password) => setLogin({ ...login, password })}
              onForgotClick={openForgotModal}
            />

            {errorMessage && (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <button className="cb-auth-submit" type="submit" disabled={pending}>
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              <span>{pending ? "Signing in…" : "Sign in"}</span>
            </button>
          </form>

          <div className="cb-auth-divider" aria-hidden="true">
            <span>or browse first</span>
          </div>

          <Link to="/discover" className="cb-auth-secondary">
            <Compass size={16} className="text-[#059669]" aria-hidden="true" />
            <span>Explore Public Groups</span>
          </Link>

          <p className="cb-auth-switch">
            Don’t have an account?{" "}
            <button type="button" onClick={() => switchMode("signup")} disabled={pending}>
              Create account
            </button>
          </p>
        </div>
      ) : registrationEmail ? (
        <div className="space-y-4 py-2 text-center" role="status">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e4f7ed] text-[#059669]">
            <MailCheck size={24} aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="font-['Instrument_Sans',sans-serif] text-lg font-bold text-[#0f172a]">
              Check your inbox
            </h3>
            <p className="break-words text-sm leading-relaxed text-[#64748b]">
              Confirm your email using the verification link sent to{" "}
              <strong className="font-semibold text-[#0f172a]">{registrationEmail}</strong>.
            </p>
          </div>
          <button
            type="button"
            className="cb-auth-secondary"
            onClick={() => switchMode("signin")}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <div>
          <form onSubmit={handleSubmit} className="space-y-3.5" aria-label="Sign up">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="cb-auth-label">
                Full name
              </Label>
              <Input
                id="signup-name"
                name="name"
                autoComplete="name"
                placeholder="e.g. Aliyu Wada"
                required
                value={registration.name}
                onChange={(event) =>
                  setRegistration({ ...registration, name: event.target.value })
                }
                className="cb-auth-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="cb-auth-label">
                Email address
              </Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={registration.email}
                onChange={(event) =>
                  setRegistration({ ...registration, email: event.target.value })
                }
                className="cb-auth-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-phone" className="cb-auth-label">
                Phone number
              </Label>
              <Input
                id="signup-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. +2348012345678"
                required
                maxLength={28}
                value={registration.phone}
                onChange={(event) =>
                  setRegistration({ ...registration, phone: event.target.value })
                }
                className="cb-auth-input"
              />
            </div>

            <PasswordField
              id="signup-password"
              value={registration.password}
              onChange={(password) => setRegistration({ ...registration, password })}
              creating
            />

            {errorMessage && (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <button
              className="cb-auth-submit mt-1"
              type="submit"
              disabled={pending || !meetsPasswordRequirements(registration.password)}
            >
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              <span>{pending ? "Creating account…" : "Create account"}</span>
            </button>
          </form>

          <p className="cb-auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={() => switchMode("signin")} disabled={pending}>
              Sign in
            </button>
          </p>
        </div>
      )}

      {/* Cashbuddy-style Clean Forgot Password Modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="font-['Instrument_Sans',sans-serif] text-lg font-bold text-slate-900">
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Enter your account email and we’ll send you a secure reset link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordReset} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">
                Email address
              </Label>
              <Input
                id="reset-email"
                type="email"
                required
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus-visible:bg-white"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
                className="h-10 rounded-xl border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={resetPending || !resetEmail.trim()}
                className="h-10 rounded-xl bg-[#071913] font-semibold text-white hover:bg-[#0d2b21]"
              >
                {resetPending ? "Sending…" : "Send Reset Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
