
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { ArrowLeft, Users } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

const ContributePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contributions, contribute } = useApp();
  
  const [contribution, setContribution] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
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
    
    // Process contribution
    try {
      contribute(contribution.id, Number(amount));
      setAmount("");
      toast.success("Thank you for your contribution!");
    } catch (error) {
      toast.error("Failed to process contribution");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold">Contribute</h1>
          <p className="text-muted-foreground">Support this contribution group</p>
        </div>
        
        <Card className="glass-card animate-scale">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users size={24} />
              </div>
              <div>
                <CardTitle>{contribution.name}</CardTitle>
                <CardDescription>{contribution.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">₦{contribution.currentAmount.toLocaleString()}</span>
                <span className="text-muted-foreground">₦{contribution.targetAmount.toLocaleString()}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-right text-muted-foreground">{progressPercentage}% Funded</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contribution-amount">Contribution Amount</Label>
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
            <p className="text-xs text-center text-muted-foreground">
              Your contribution helps this group achieve their goal.
            </p>
          </CardFooter>
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default ContributePage;
