import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

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
          minLength={creating ? 8 : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="auth-input h-12 pr-12"
          aria-describedby={creating ? id + "-hint" : undefined}
        />
        <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-12 w-12" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </Button>
      </div>
      {creating && <p id={id + "-hint"} className="text-sm text-muted-foreground">Use at least 8 characters.</p>}
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrorMessage("");

    try {
      if (mode === "signup") {
        const name = registration.name.trim();
        if (!name) {
          setErrorMessage("Enter your full name.");
          return;
        }
        const { error } = await signUp(registration.email, registration.password, { name, phone: registration.phone.trim() });
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
      <Tabs value={mode} onValueChange={(value) => {
        setErrorMessage("");
        onModeChange(value === "signup" ? "signup" : "signin");
      }}>
        <TabsList className="auth-modes grid w-full grid-cols-2" aria-label="Account access">
          <TabsTrigger value="signin" disabled={pending}>Sign in</TabsTrigger>
          <TabsTrigger value="signup" disabled={pending}>Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <form onSubmit={handleSubmit} className="space-y-4 pt-4" aria-label="Sign in">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email address</Label>
              <Input id="login-email" name="email" type="email" autoComplete="email" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} className="auth-input h-12" />
            </div>
            <PasswordField id="login-password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
            {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
            <Button className="auth-submit h-12 w-full" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={17} aria-hidden="true" /></Button>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          {registrationEmail ? (
            <div className="space-y-3 py-4" role="status">
              <MailCheck size={27} className="text-primary" aria-hidden="true" />
              <h2 className="app-section-title">Check your inbox</h2>
              <p className="break-words text-sm text-muted-foreground">Confirm your email using the link sent to {registrationEmail}.</p>
              <Button variant="outline" onClick={() => onModeChange("signin")}>Back to sign in</Button>
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
                <Label htmlFor="signup-phone">Phone number <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="signup-phone" name="phone" type="tel" autoComplete="tel" value={registration.phone} onChange={(event) => setRegistration({ ...registration, phone: event.target.value })} className="auth-input h-12" />
              </div>
              <PasswordField id="signup-password" value={registration.password} onChange={(password) => setRegistration({ ...registration, password })} creating />
              {errorMessage && <p className="text-sm text-destructive" role="alert">{errorMessage}</p>}
              <Button className="auth-submit h-12 w-full" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}<ArrowRight size={17} aria-hidden="true" /></Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
