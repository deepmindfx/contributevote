import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, Mail, Phone, User, Key, Lock, Shield } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { useApp } from "@/contexts/AppContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const AuthForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPScreen, setShowOTPScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  
  const [loginData, setLoginData] = useState({
    phone: "",
    password: ""
  });
  
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: ""
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  const {
    refreshData,
    sendVerificationEmail,
    verifyUserWithOTPCode
  } = useApp();

  // Get return URL if user was redirected from a protected page
  const {
    state
  } = location;
  const returnUrl = state?.returnUrl || "/dashboard";
  
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simple validation
    if (!loginData.phone || !loginData.password) {
      toast.error("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    // For regular users - check if user exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const foundUser = users.find((u: any) => u.phone === loginData.phone || u.email === loginData.phone);
    if (!foundUser) {
      toast.error("User not found. Please check your credentials or register.");
      setIsLoading(false);
      return;
    }

    // In a real app, we would verify the password here
    // For now, we'll just log the user in

    localStorage.setItem('currentUser', JSON.stringify(foundUser));

    // Important: Refresh app context data after login
    refreshData();
    setIsLoading(false);
    toast.success("Login successful");

    // Navigate to returnUrl or dashboard
    setTimeout(() => {
      navigate(returnUrl);
    }, 500);
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simple validation
    if (!registerData.firstName || !registerData.lastName || !registerData.phone || !registerData.email || !registerData.password) {
      toast.error("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      // Store new user in localStorage
      const fullName = `${registerData.firstName} ${registerData.lastName}`;
      const user = {
        id: uuidv4(),
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        name: fullName,
        email: registerData.email,
        phone: registerData.phone,
        walletBalance: 0,
        preferences: {
          anonymousContributions: false,
          darkMode: false
        },
        notifications: [],
        role: "user" as const,
        status: "active" as const,
        createdAt: new Date().toISOString(),
        verified: false
      };

      // Add to users array
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      users.push(user);
      localStorage.setItem('users', JSON.stringify(users));

      // Set as current user
      localStorage.setItem('currentUser', JSON.stringify(user));

      // Important: Refresh app context data after registration
      refreshData();
      
      // Send verification email
      const emailSent = await sendVerificationEmail(user.id, user.email);
      
      if (emailSent) {
        // Show OTP verification screen
        setUserId(user.id);
        setShowOTPScreen(true);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to create account. Please try again.");
      setIsLoading(false);
    }
  };
  
  const handleVerifyOTP = () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }
    
    const isVerified = verifyUserWithOTPCode(userId, otp);
    
    if (isVerified) {
      // Navigate to dashboard after successful verification
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  };
  
  if (showOTPScreen) {
    return (
      <Card className="w-full max-w-md mx-auto animate-scale glass-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Verify Your Account</CardTitle>
          <CardDescription className="text-center">
            We've sent a verification code to your email address. Please enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button 
              onClick={handleVerifyOTP} 
              className="w-full bg-[#2DAE75] hover:bg-[#259d68]"
            >
              <Shield className="mr-2 h-4 w-4" />
              Verify Account
            </Button>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Didn't receive the code?{" "}
              <a 
                href="#" 
                className="text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  sendVerificationEmail(userId, registerData.email);
                }}
              >
                Resend
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-md mx-auto animate-scale glass-card">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Phone Number or Email" type="text" name="phone" className="pl-10" value={loginData.phone} onChange={handleLoginChange} required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Password" type="password" name="password" className="pl-10" value={loginData.password} onChange={handleLoginChange} required />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full text-white bg-[#2DAE75] hover:bg-[#259d68]">
                {isLoading ? <div className="flex items-center">
                    <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                    Logging in...
                  </div> : <div className="flex items-center">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </div>}
              </Button>
            </form>
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.5454 6.54545H8.36363V9.45454H12.5C12.1454 11.1 10.8636 12.0909 8.36363 12.0909C5.49091 12.0909 3.27273 9.87273 3.27273 7C3.27273 4.12727 5.49091 1.90909 8.36363 1.90909C9.55454 1.90909 10.6364 2.32727 11.4727 3.05454L13.6909 0.836363C12.2182 -0.381818 10.4 -0.9 8.36363 -0.9C3.98182 -0.9 0.363636 2.61818 0.363636 7C0.363636 11.3818 3.98182 14.9 8.36363 14.9C12.3909 14.9 15.6364 12 15.6364 7C15.6364 6.85454 15.5818 6.69091 15.5454 6.54545Z" fill="#4285F4" />
                  </svg>
                  Google
                </Button>
                <Button variant="outline" className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.00002 0.5C3.8145 0.5 0.25 3.78952 0.25 7.95066C0.25 11.1227 2.41894 13.8069 5.35332 14.8084C5.72738 14.8739 5.85742 14.6407 5.85742 14.4398C5.85742 14.2582 5.85156 13.8084 5.84864 13.1924C3.82646 13.638 3.38966 12.2539 3.38966 12.2539C3.05302 11.3873 2.57894 11.1556 2.57894 11.1556C1.91991 10.6937 2.63087 10.7031 2.63087 10.7031C3.3615 10.7578 3.75194 11.4761 3.75194 11.4761C4.40303 12.6089 5.44541 12.2896 5.87108 12.0962C5.9366 11.6192 6.12694 11.3003 6.33736 11.1233C4.70352 10.9443 2.98518 10.302 2.98518 7.5101C2.98518 6.69746 3.27334 6.03184 3.76733 5.50574C3.69302 5.31414 3.44064 4.57894 3.84088 3.56501C3.84088 3.56501 4.45347 3.36167 5.84082 4.31494C6.43801 4.14788 7.06921 4.06502 7.69748 4.06208C8.32574 4.06501 8.95674 4.14788 9.55392 4.31494C10.9413 3.36167 11.5533 3.56501 11.5533 3.56501C11.9542 4.57894 11.7019 5.31414 11.6275 5.50574C12.1222 6.03184 12.4096 6.69747 12.4096 7.5101C12.4096 10.3097 10.6883 10.9429 9.05074 11.1181C9.31322 11.3375 9.54712 11.7708 9.54712 12.4354C9.54712 13.3871 9.53864 14.1869 9.53864 14.4398C9.53864 14.6421 9.66738 14.8768 10.0473 14.8078C12.9775 13.8046 15.15 11.1219 15.15 7.95066C15.15 3.78951 11.5857 0.5 8.00002 0.5Z" fill="#24292F" />
                  </svg>
                  GitHub
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account? 
              <a href="#" className="text-primary ml-1 hover:underline">Create account</a>
            </p>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="register">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">Enter your information to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="First Name" name="firstName" className="pl-10" value={registerData.firstName} onChange={handleRegisterChange} required />
                  </div>
                  <div className="relative">
                    <Input placeholder="Last Name" name="lastName" value={registerData.lastName} onChange={handleRegisterChange} required />
                  </div>
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Phone Number" type="tel" name="phone" className="pl-10" value={registerData.phone} onChange={handleRegisterChange} required />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Email Address" type="email" name="email" className="pl-10" value={registerData.email} onChange={handleRegisterChange} required />
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Create Password" type="password" name="password" className="pl-10" value={registerData.password} onChange={handleRegisterChange} required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-[#2DAE75] hover:bg-[#259d68]" disabled={isLoading}>
                {isLoading ? <div className="flex items-center">
                    <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                    Creating account...
                  </div> : <div className="flex items-center">
                    <LogIn className="mr-2 h-4 w-4" />
                    Register
                  </div>}
              </Button>
            </form>
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.5454 6.54545H8.36363V9.45454H12.5C12.1454 11.1 10.8636 12.0909 8.36363 12.0909C5.49091 12.0909 3.27273 9.87273 3.27273 7C3.27273 4.12727 5.49091 1.90909 8.36363 1.90909C9.55454 1.90909 10.6364 2.32727 11.4727 3.05454L13.6909 0.836363C12.2182 -0.381818 10.4 -0.9 8.36363 -0.9C3.98182 -0.9 0.363636 2.61818 0.363636 7C0.363636 11.3818 3.98182 14.9 8.36363 14.9C12.3909 14.9 15.6364 12 15.6364 7C15.6364 6.85454 15.5818 6.69091 15.5454 6.54545Z" fill="#4285F4" />
                  </svg>
                  Google
                </Button>
                <Button variant="outline" className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.6 8.2C12.5 6.1 14.1 5.2 14.2 5.1C13.2 3.7 11.6 3.5 11.1 3.5C9.7 3.4 8.4 4.4 7.7 4.4C6.9 4.4 5.9 3.6 4.7 3.6C3.1 3.6 1.6 4.6 0.8 6.1C-0.7 9.2 0.5 13.6 2 16C2.8 17.1 3.8 18.4 5.1 18.3C6.3 18.3 6.8 17.5 8.2 17.5C9.6 17.5 10.1 18.3 11.3 18.3C12.6 18.3 13.5 17.1 14.2 16C15.1 14.8 15.5 13.6 15.5 13.5C15.4 13.5 12.7 12.5 12.6 8.2Z" fill="#000000" />
                    <path d="M10.5 1C11.2 0.2 11.6 -0.8 11.5 -1.8C10.7 -1.7 9.7 -1.2 9 -0.3C8.3 0.5 7.8 1.5 7.9 2.4C8.8 2.5 9.7 1.9 10.5 1Z" fill="#000000" />
                  </svg>
                  Apple
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account? 
              <a href="#" className="text-primary ml-1 hover:underline">Sign in</a>
            </p>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AuthForm;
