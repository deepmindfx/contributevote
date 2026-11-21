import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Key, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const navigate = useNavigate();
  const { signIn, logout, isAuthenticated, isAdmin } = useSupabaseUser();

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!loginData.email || !loginData.password) {
        toast.error("Please fill in all fields");
        return;
      }

      const { error, profile } = await signIn(loginData.email, loginData.password);

      if (error) {
        toast.error(error.message || "Invalid admin credentials");
        return;
      }

      if (!profile || profile.role !== "admin") {
        await logout();
        toast.error("Access denied. This account does not have administrator privileges.");
        return;
      }

      toast.success("Admin login successful");
      navigate("/admin", { replace: true });
    } catch (error: any) {
      console.error("Admin login error:", error);
      toast.error(error?.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-32">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Admin Access</h2>
            <p className="text-muted-foreground mt-2">
              Secure login for CollectiPay administrators
            </p>
          </div>

          <Card className="w-full max-w-md mx-auto animate-scale glass-card">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
              <CardDescription className="text-center">
                Sign in with your authorized administrator account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Admin Email"
                      type="email"
                      name="email"
                      className="pl-10"
                      value={loginData.email}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Admin Password"
                      type="password"
                      name="password"
                      className="pl-10"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                      Logging in...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Key className="mr-2 h-4 w-4" />
                      Admin Login
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center">
              <p className="text-sm text-muted-foreground">
                Regular user?
                <Button
                  variant="link"
                  onClick={() => navigate("/auth")}
                  className="p-0 h-auto font-normal ml-1"
                >
                  Sign in here
                </Button>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
