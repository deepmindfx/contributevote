import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import Header from "@/components/layout/Header";
import { ensureAccountNumberDisplay } from "@/localStorage";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
const ContributeSharePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useSupabaseUser();
  const { contribute } = useSupabaseContribution();
  const navigate = useNavigate();
  const [contribution, setContribution] = useState<any>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (id) {
      // Ensure account numbers are displayed
      ensureAccountNumberDisplay();
      
      const allContributions = getContributions();
      const foundContribution = allContributions.find(c => c.id === id);
      if (foundContribution) {
        setContribution(foundContribution);
        // Set the default contribution amount if available
        if (foundContribution.contributionAmount) {
          setAmount(foundContribution.contributionAmount);
        }
      }
    }
  }, [id]);
  
  // Get all contributions, not just the user's contributions
  const getContributions = () => {
    const contributionsString = localStorage.getItem('contributions');
    if (!contributionsString) {
      return [];
    }
    return JSON.parse(contributionsString);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmount(isNaN(value) ? 0 : value);
  };
  
  const handleContribute = () => {
    if (!isAuthenticated) {
      toast.error("Please log in to contribute");
      navigate("/auth", { state: { returnUrl: `/contribute/share/${id}` } });
      return;
    }
    
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    // Check if amount meets minimum requirement
    if (contribution.contributionAmount && amount < contribution.contributionAmount) {
      toast.error(`Minimum contribution amount is ₦${contribution.contributionAmount.toLocaleString()}`);
      return;
    }
    
    if (user.wallet_balance < amount) {
      toast.error("Insufficient funds in your wallet");
      return;
    }
    
    setIsLoading(true);
    
    // Process contribution
    setTimeout(() => {
      contribute(contribution.id, amount, isAnonymous);
      setIsLoading(false);
      toast.success(`Successfully contributed ₦${amount.toLocaleString()} to ${contribution.name}`);
      navigate(`/groups/${contribution.id}`);
    }, 1000);
  };
  
  if (!contribution) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center p-4 pt-24">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-4">Contribution Not Found</CardTitle>
              <CardDescription>
                The contribution you're looking for doesn't exist or may have been deleted.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link to="/">Return Home</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex flex-col items-center justify-center p-4 pt-24 bg-background">
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary p-2 text-primary-foreground">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <CardTitle>Contribute to {contribution.name}</CardTitle>
            <CardDescription>
              Join others in this contribution group
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{contribution.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{contribution.name}</p>
                <p className="text-sm text-muted-foreground">
                  {contribution.description.substring(0, 50)}
                  {contribution.description.length > 50 ? "..." : ""}
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Contribution Progress</p>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full"
                  style={{ 
                    width: `${Math.min(
                      (contribution.currentAmount / contribution.targetAmount) * 100, 
                      100
                    )}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>₦{contribution.currentAmount.toLocaleString()}</span>
                <span>₦{contribution.targetAmount.toLocaleString()}</span>
              </div>
            </div>
            
            <Separator />
            
            {contribution.accountNumber && (
              <div className="p-3 bg-secondary/30 rounded-lg">
                {/* Replace the manual account display with AccountNumberDisplay component */}
                <AccountNumberDisplay 
                  accountNumber={contribution.accountNumber} 
                  accountName={contribution.name}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You can also transfer directly to this account
                </p>
              </div>
            )}
            
            <Separator />
            
            <div className="space-y-3">
              <Label htmlFor="amount">Contribution Amount</Label>
              <Input
                id="amount"
                type="number"
                min={contribution.contributionAmount}
                step="100"
                placeholder="Enter amount"
                value={amount || ''}
                onChange={handleAmountChange}
              />
              {contribution.contributionAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Minimum contribution: ₦{contribution.contributionAmount.toLocaleString()}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2 pt-2">
                {[500, 1000, 5000, 10000].map(value => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setAmount(value)}
                    disabled={value < contribution.contributionAmount}
                  >
                    ₦{value.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Contribution Privacy</Label>
              <RadioGroup defaultValue="public" className="pt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" 
                    checked={!isAnonymous}
                    onClick={() => setIsAnonymous(false)}
                  />
                  <Label htmlFor="public" className="cursor-pointer">
                    Public (Your name will be visible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anonymous" id="anonymous" 
                    checked={isAnonymous}
                    onClick={() => setIsAnonymous(true)}
                  />
                  <Label htmlFor="anonymous" className="cursor-pointer">
                    Anonymous (Your name will be hidden)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button 
              className="w-full" 
              onClick={handleContribute}
              disabled={isLoading || amount <= 0}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></span>
                  Processing...
                </>
              ) : (
                `Contribute ₦${amount.toLocaleString()}`
              )}
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ContributeSharePage;
