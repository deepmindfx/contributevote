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
import { ContributionService } from "@/services/supabase/contributionService";
import { WalletContributionService } from "@/services/supabase/walletContributionService";
import Header from "@/components/layout/Header";

const ContributePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, refreshCurrentUser } = useSupabaseUser();
  const { contributions, refreshContributionData } = useSupabaseContribution();
  const [contribution, setContribution] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [amount, setAmount] = useState<number>(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadGroup = async () => {
      if (!id) {
        setFetching(false);
        return;
      }

      const found = contributions.find((c) => c.id === id);
      if (found) {
        setContribution(found);
        if (found.contribution_amount) {
          setAmount(Number(found.contribution_amount));
        }
        setFetching(false);
        return;
      }

      try {
        const fetched = await ContributionService.getContributionGroupById(id);
        if (fetched) {
          setContribution(fetched);
          if (fetched.contribution_amount) {
            setAmount(Number(fetched.contribution_amount));
          }
        }
      } catch (error) {
        console.error("Error loading group:", error);
      } finally {
        setFetching(false);
      }
    };

    loadGroup();
  }, [id, contributions]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmount(isNaN(value) ? 0 : value);
  };

  const handleContribute = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please log in to contribute");
      navigate(`/auth?redirect=/contribute/${id}`);
      return;
    }

    if (amount < 100) {
      toast.error("Minimum contribution amount is ₦100");
      return;
    }

    const minAmount = Number(contribution?.contribution_amount || 0);
    if (minAmount > 0 && amount < minAmount) {
      toast.error(`Minimum contribution amount is ₦${minAmount.toLocaleString()}`);
      return;
    }

    const walletBalance = Number(user.wallet_balance || 0);
    if (walletBalance < amount) {
      toast.error("Insufficient funds in your wallet");
      return;
    }

    setIsLoading(true);
    try {
      const result = await WalletContributionService.contributeFromWallet(
        user.id,
        contribution.id,
        amount,
        isAnonymous
      );

      if (result.success) {
        await Promise.all([refreshCurrentUser(), refreshContributionData()]);
        navigate(`/groups/${contribution.id}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to process contribution");
    } finally {
      setIsLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

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
                <Link to="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const currentAmount = Number(contribution.current_amount || 0);
  const targetAmount = Number(contribution.target_amount || 1);
  const minContribution = Number(contribution.contribution_amount || 0);
  const description = contribution.description || "";

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
              Wallet Balance: ₦{Number(user?.wallet_balance || 0).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{contribution.name?.charAt(0) || "G"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{contribution.name}</p>
                <p className="text-sm text-muted-foreground">
                  {description.substring(0, 60)}
                  {description.length > 60 ? "..." : ""}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Contribution Progress</p>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.min((currentAmount / targetAmount) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>₦{currentAmount.toLocaleString()}</span>
                <span>₦{targetAmount.toLocaleString()}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="amount">Contribution Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                min={minContribution || 100}
                step="100"
                placeholder="Enter amount"
                value={amount || ""}
                onChange={handleAmountChange}
              />
              {minContribution > 0 && (
                <p className="text-xs text-muted-foreground">
                  Suggested minimum: ₦{minContribution.toLocaleString()}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {[500, 1000, 5000, 10000].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setAmount(value)}
                    disabled={minContribution > 0 && value < minContribution}
                  >
                    ₦{value.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contribution Privacy</Label>
              <RadioGroup
                value={isAnonymous ? "anonymous" : "public"}
                onValueChange={(v) => setIsAnonymous(v === "anonymous")}
                className="pt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="cursor-pointer">
                    Public (Your name will be visible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anonymous" id="anonymous" />
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
              {isLoading ? "Processing..." : `Contribute ₦${amount.toLocaleString()}`}
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ContributePage;
