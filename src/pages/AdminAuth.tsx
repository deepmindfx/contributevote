import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLoader, { CollectiPayMark } from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ identifier: "", password: "" });
  const navigate = useNavigate();
  const { signIn, logout, isAuthenticated, isAdmin } = useSupabaseUser();

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawIdentifier = loginData.identifier.trim();
    const password = loginData.password;

    if (!rawIdentifier || !password) {
      toast.error("Enter your administrator email and password");
      return;
    }

    setIsLoading(true);
    try {
      const { error, profile } = await signIn(rawIdentifier, password);

      if (error) {
        toast.error("Couldn’t sign in. Check your credentials and try again.");
        return;
      }

      if (!profile || profile.role !== "admin" || (profile.status ?? "active") !== "active") {
        await logout();
        toast.error("Couldn’t sign in. Check your credentials and try again.");
        return;
      }

      toast.success("Welcome to Super Admin Command Center");
      navigate("/admin", { replace: true });
    } catch {
      toast.error("Couldn’t sign in. Try again shortly.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {isLoading && (
        <BrandLoader
          variant="overlay"
          badge="Super Admin"
          message="Verifying administrator access"
          submessage="Authenticating session & loading command center…"
        />
      )}

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md space-y-5">
          {/* Deep-Emerald Brand Header Card */}
          <div className="overflow-hidden rounded-[1.5rem] border bg-card shadow-lg">
            <div className="bg-gradient-to-br from-[#075847] via-[#06483b] to-[#043229] px-6 py-7 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm">
                  <CollectiPayMark size={36} />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#dbf5b4] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0c3027]">
                    <ShieldCheck className="h-3 w-3" />
                    Restricted Portal
                  </span>
                  <h1 className="mt-1 text-xl font-bold tracking-tight">
                    Super Admin Access
                  </h1>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#cce9db]">
                Sign in with your administrator email to manage AML compliance, users, pools, and gateway settings.
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-identifier" className="text-xs font-semibold">
                    Administrator email
                  </Label>
                  <div className="relative">
                    <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="admin-identifier"
                      name="identifier"
                      type="email"
                      autoComplete="username"
                      placeholder="Enter your administrator email"
                      className="h-12 rounded-xl pl-10"
                      value={loginData.identifier}
                      onChange={(e) =>
                        setLoginData((prev) => ({ ...prev, identifier: e.target.value }))
                      }
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-password" className="text-xs font-semibold">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter admin password"
                      className="h-12 rounded-xl pl-10 pr-12"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData((prev) => ({ ...prev, password: e.target.value }))
                      }
                      disabled={isLoading}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 h-12 w-12 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl font-bold shadow-sm"
                  disabled={isLoading}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isLoading ? "Signing in…" : "Sign in to Command Center"}
                </Button>
              </form>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminAuth;
