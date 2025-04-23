
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const AuthForm = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signIn(loginEmail, loginPassword);
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      // Don't reset the form on error to allow the user to correct it
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (registerPassword !== registerConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    if (registerPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signUp(registerEmail, registerPassword, { name: registerName });
      toast.success("Registration successful! Please check your email for verification.", {
        duration: 5000
      });
      // Switch to login tab after successful registration
      setActiveTab("login");
      setLoginEmail(registerEmail);
      
      // Reset registration form
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.message && error.message.includes("already registered")) {
        toast.error("Email already registered. Please use a different email or try logging in.");
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="register">Register</TabsTrigger>
      </TabsList>
      
      <TabsContent value="login">
        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="#" className="text-sm text-muted-foreground hover:underline">
                Forgot password?
              </a>
            </div>
            <Input 
              id="password" 
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </TabsContent>
      
      <TabsContent value="register">
        <form onSubmit={handleRegister} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              placeholder="John Doe"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input 
              id="register-email" 
              type="email" 
              placeholder="you@example.com"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <Input 
              id="register-password" 
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input 
              id="confirm-password" 
              type="password"
              value={registerConfirmPassword}
              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
};

export default AuthForm;
