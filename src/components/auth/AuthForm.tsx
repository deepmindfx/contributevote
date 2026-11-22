import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { meetsPasswordRequirements, PASSWORD_MIN_LENGTH, passwordIssue } from "@/lib/passwordPolicy";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { normalizeSignupPhone, SIGNUP_PHONE_ERROR } from "@/lib/signupPhone";

type AuthMode = "signin" | "signup";

function PasswordField({ id, value, onChange, creating = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  creating?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Password</Label>
      <div className="relative">
        <Input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          required
          minLength={creating ? PASSWORD_MIN_LENGTH : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="auth-input h-12 pr-12"
          aria-describedby={creating ? id + "-hint" : undefined}
        />
        <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-12 w-12" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </Button>
      </div>
      {creating && <PasswordRequirements id={id + "-hint"} password={value} />}
    </div>
  );
}

export default function AuthForm({ mode, onModeChange }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void }) {
  const { signIn, signUp } = useSupabaseUser();
  const [login, setLogin] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({ name: "", email: "", phone: "", password: "" });
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const prevModeRef = useRef<AuthMode>(mode);
  const [direction, setDirection] = useState<"forward" | "backward" | "none">("none");
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (prevModeRef.current !== mode) {
      setDirection(mode === "signup" ? "forward" : "backward");
      prevModeRef.current = mode;
    }
  }, [mode]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const syncHeight = () => {
      const nextHeight = Math.ceil(el.getBoundingClientRect().height);
      if (nextHeight > 0) setPanelHeight(nextHeight);
    };
    syncHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, registrationEmail, errorMessage]);

  const switchMode = (nextMode: AuthMode) => {
    if (pending || nextMode === mode) return;
    setErrorMessage("");
    setDirection(nextMode === "signup" ? "forward" : "backward");
    prevModeRef.current = nextMode;
    onModeChange(nextMode);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      switchMode(mode === "signin" ? "signup" : "signin");
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
        if (!phone) { setErrorMessage(SIGNUP_PHONE_ERROR); return; }
        const { error } = await signUp(registration.email, registration.password, { name, phone });
        if (error) setErrorMessage(error.message || "Registration failed.");
        else setRegistrationEmail(registration.email.trim());
      } else {
        const { error } = await signIn(login.email, login.password);
        if (error) setErrorMessage(error.message || "Sign-in failed.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-modes" role="tablist" aria-label="Account access">
        <span
          className="auth-mode-indicator"
          data-mode={mode}
          aria-hidden="true"
        />
        <button
          id="auth-tab-signin"
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          aria-controls="auth-panel-signin"
          tabIndex={mode === "signin" ? 0 : -1}
          disabled={pending}
          onKeyDown={handleTabKeyDown}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          id="auth-tab-signup"
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          aria-controls="auth-panel-signup"
          tabIndex={mode === "signup" ? 0 : -1}
          disabled={pending}
          onKeyDown={handleTabKeyDown}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <div
        className="auth-panel-stage"
        style={panelHeight !== undefined ? { height: `${panelHeight}px` } : undefined}
      >
        <div
          key={mode}
          ref={panelRef}
          id={mode === "signin" ? "auth-panel-signin" : "auth-panel-signup"}
          role="tabpanel"
          aria-labelledby={mode === "signin" ? "auth-tab-signin" : "auth-tab-signup"}
          data-direction={direction}
          className="auth-panel-content"
        >
          {mode === "signin" ? (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4" aria-label="Sign in">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email address</Label>
                <Input id="login-email" name="email" type="email" autoComplete="email" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} className="auth-input h-12" />
              </div>
              <PasswordField id="login-password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
              {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
              <Button className="auth-submit h-12 w-full" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={17} aria-hidden="true" /></Button>
            </form>
          ) : registrationEmail ? (
            <div className="space-y-3 py-4" role="status">
              <MailCheck size={27} className="text-primary" aria-hidden="true" />
              <h2 className="app-section-title">Check your inbox</h2>
              <p className="break-words text-sm text-muted-foreground">Confirm your email using the link sent to {registrationEmail}.</p>
              <Button variant="outline" onClick={() => switchMode("signin")}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4" aria-label="Sign up">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full name</Label>
                <Input id="signup-name" name="name" autoComplete="name" required value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} className="auth-input h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email address</Label>
                <Input id="signup-email" name="email" type="email" autoComplete="email" required value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} className="auth-input h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone number</Label>
                <Input id="signup-phone" name="phone" type="tel" autoComplete="tel" required maxLength={28} value={registration.phone}
                  onChange={(event) => setRegistration({ ...registration, phone: event.target.value })} className="auth-input h-12" />
              </div>
              <PasswordField id="signup-password" value={registration.password} onChange={(password) => setRegistration({ ...registration, password })} creating />
              {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
              <Button className="auth-submit h-12 w-full" type="submit" disabled={pending || !meetsPasswordRequirements(registration.password)}>{pending ? "Creating account…" : "Create account"}<ArrowRight size={17} aria-hidden="true" /></Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
