
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const navigate = useNavigate();

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simple validation
    if (!loginData.username || !loginData.password) {
      toast.error("Please fill in all fields");
      setIsLoading(false);
      return;
    }
    
    // Check admin credentials
    if (loginData.username === "admin" && loginData.password === "1234") {
      // Admin login successful
      const adminUser = {
        id: "admin-user-id",
        firstName: "Admin",
        lastName: "User",
        name: "Admin User",
        email: "admin@collectipay.com",
        phoneNumber: "admin",
        walletBalance: 0,
        preferences: {
          anonymousContributions: false,
          darkMode: false,
          notificationsEnabled: true,
        },
        notifications: [],
        role: "admin" as const,
        status: "active" as const,
        createdAt: new Date().toISOString(),
      };
      
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      setIsLoading(false);
      toast.success("Admin login successful");
      navigate("/admin");
    } else {
      toast.error("Invalid admin credentials");
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
                Enter your admin credentials to access the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input 
                      placeholder="Admin Username" 
                      type="text" 
                      name="username"
                      className="pl-3" 
                      value={loginData.username}
                      onChange={handleLoginChange}
                      required 
                    />
                  </div>
                  <div className="relative">
                    <Input 
                      placeholder="Admin Password" 
                      type="password" 
                      name="password"
                      className="pl-3" 
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
                <Button variant="link" onClick={() => navigate("/auth")} className="p-0 h-auto font-normal">
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
