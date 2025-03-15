
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Users, 
  Shield, 
  CreditCard, 
  Landmark, 
  Smartphone,
  Check,
  ArrowUpRight,
  EyeOff
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ContributePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contributions, contribute, user } = useApp();
  
  const [contribution, setContribution] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [anonymous, setAnonymous] = useState(user.preferences?.anonymousContributions || false);
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  useEffect(() => {
    if (!id) return;
    
    const foundContribution = contributions.find(c => c.id === id);
    if (!foundContribution) {
      toast.error("Contribution group not found");
      navigate("/dashboard");
      return;
    }
    
    setContribution(foundContribution);
  }, [id, contributions, navigate]);
  
  if (!contribution) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  const progressPercentage = Math.min(100, Math.round((contribution.currentAmount / contribution.targetAmount) * 100));
  
  const handleContribute = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsLoading(true);
    
    // Process contribution (simulated payment process)
    setTimeout(() => {
      try {
        contribute(contribution.id, Number(amount), anonymous);
        setAmount("");
        setShowSuccessMessage(true);
        
        // Redirect after success message shown
        setTimeout(() => {
          navigate(`/groups/${id}`);
        }, 3000);
      } catch (error) {
        toast.error("Failed to process contribution");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  if (showSuccessMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full glass-card">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center mb-4">
              <Check size={32} />
            </div>
            <CardTitle className="text-xl mb-2">Payment Successful!</CardTitle>
            <CardDescription className="mb-6">
              Your contribution of ₦{parseInt(amount).toLocaleString()} has been processed successfully.
            </CardDescription>
            <p className="text-sm text-muted-foreground mb-6">
              Redirecting you to the contribution details page...
            </p>
            <Button 
              className="w-full"
              onClick={() => navigate(`/groups/${id}`)}
            >
              View Contribution
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container max-w-md mx-auto px-4 pt-24 pb-12">
        <div className="mb-6 animate-fade-in">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
        
        <Card className="glass-card animate-scale mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {contribution.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{contribution.name}</CardTitle>
                <CardDescription>{contribution.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">₦{contribution.currentAmount.toLocaleString()}</span>
                <span className="text-muted-foreground">₦{contribution.targetAmount.toLocaleString()}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-right text-muted-foreground">{progressPercentage}% Funded</p>
            </div>
            
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center">
                <Users size={16} className="text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">{contribution.members.length} members</span>
              </div>
              <div className="flex items-center">
                <Shield size={16} className="text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Secure</span>
              </div>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="pt-4">
            <div className="text-sm text-muted-foreground">
              Funds will be held securely until voted upon by members.
            </div>
          </CardFooter>
        </Card>
        
        <Card className="glass-card animate-scale">
          <CardHeader>
            <CardTitle>Make a Contribution</CardTitle>
            <CardDescription>Support this group with your contribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contribution-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                  <Input
                    id="contribution-amount"
                    type="number"
                    className="pl-8"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Minimum contribution: ₦{contribution.contributionAmount.toLocaleString()}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="anonymous" 
                  checked={anonymous} 
                  onCheckedChange={(checked) => setAnonymous(checked as boolean)}
                />
                <label
                  htmlFor="anonymous"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Contribute anonymously
                </label>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <Label>Payment Method</Label>
              <Tabs defaultValue="card" onValueChange={setPaymentMethod} value={paymentMethod}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="card">Card</TabsTrigger>
                  <TabsTrigger value="bank">Bank</TabsTrigger>
                  <TabsTrigger value="mobile">Mobile</TabsTrigger>
                </TabsList>
                
                <TabsContent value="card" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input id="card-number" placeholder="1234 5678 9012 3456" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="bank" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input id="bank-name" placeholder="Your Bank" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input id="account-number" placeholder="1234567890" />
                  </div>
                </TabsContent>
                
                <TabsContent value="mobile" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Phone Number</Label>
                    <Input id="phone-number" placeholder="+234 800 000 0000" />
                  </div>
                  <div className="flex items-center rounded-md border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">Mobile Money</p>
                      <p className="text-sm text-muted-foreground">
                        You'll receive an OTP on your phone
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              className="w-full" 
              onClick={handleContribute}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                  Processing...
                </div>
              ) : (
                'Contribute Now'
              )}
            </Button>
            <div className="flex items-center justify-center text-xs text-muted-foreground space-x-1">
              <Shield className="h-3 w-3" />
              <span>All payments are secure and encrypted</span>
            </div>
          </CardFooter>
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default ContributePage;
