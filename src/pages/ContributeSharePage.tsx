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
import { supabase } from "@/integrations/supabase/client";
import { WalletContributionService } from "@/services/supabase/walletContributionService";
import Header from "@/components/layout/Header";
import BrandLoader from "@/components/ui/BrandLoader";
import AccountNumberDisplay from "@/components/contributions/AccountNumberDisplay";
import { GroupRules } from "@/components/contribution/GroupRules";
import { TransactionPinDialog } from "@/components/security/TransactionPinDialog";
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from "@/components/contribution/VerifiedCrowdfunderBadge";

const ContributeSharePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, refreshCurrentUser } = useSupabaseUser();
  const { refreshContributionData } = useSupabaseContribution();
  const navigate = useNavigate();
  const [contribution, setContribution] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [amount, setAmount] = useState<number>(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSharedGroup = async () => {
      if (!id) {
        setFetching(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("contribution_groups")
          .select("*")
          .eq("id", id)
          .eq("privacy", "public")
          .eq("status", "active")
          .single();

        if (!error && data && !data.archived) {
          setContribution(data);
          if (data.contribution_amount) {
            setAmount(Number(data.contribution_amount));
          }
        }
      } catch (error) {
        console.error("Error loading shared group:", error);
      } finally {
        setFetching(false);
      }
    };

    loadSharedGroup();
  }, [id]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setAmount(isNaN(value) ? 0 : value);
  };

  const handleContribute = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please log in to contribute");
      navigate(`/auth?redirect=/contribute/share/${id}`, {
        state: { returnUrl: `/contribute/share/${id}` },
      });
      return;
    }

    if (user.status && user.status !== "active") {
      toast.error(`Your account is currently ${user.status}. Contributions are temporarily disabled.`);
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

    if (Number(user.wallet_balance || 0) < amount) {
      toast.error("Insufficient funds in your wallet");
      return;
    }

    setPinDialogOpen(true);
  };

  const executeContribution = async (verifiedPin: string) => {
    if (!user || !contribution) return;
    setPinDialogOpen(false);
    setIsLoading(true);
    try {
      const result = await WalletContributionService.contributeFromWallet(
        user.id,
        contribution.id,
        amount,
        isAnonymous,
        verifiedPin
      );

      if (result.success) {
        await Promise.all([refreshCurrentUser(), refreshContributionData(true)]);
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
        <div className="app-page max-w-xl">
          <BrandLoader
            variant="page"
            message="Loading shared group"
            submessage="Fetching contribution details…"
          />
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
                This contribution group doesn't exist, is private, or has been archived.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link to="/discover">Browse Public Groups</Link>
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
      {isLoading && (
        <BrandLoader
          variant="overlay"
          badge="Group Contribution"
          message={`Pooling ₦${Number(amount || 0).toLocaleString()}`}
          submessage={`Confirming your contribution to ${contribution?.name || "this group"}…`}
        />
      )}
      <Header />
      <div className="flex flex-col items-center justify-center p-4 pt-24 bg-background">
        <Card className="w-full max-w-md rounded-[1.35rem]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary p-2 text-primary-foreground">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <CardTitle>Contribute to {contribution.name}</CardTitle>
            {(contribution.is_verified || contribution.is_pinned || contribution.spotlight_label) && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {(contribution.is_pinned || contribution.spotlight_label) && (
                  <SpotlightBadge label={contribution.spotlight_label} isPinned={Boolean(contribution.is_pinned)} />
                )}
                {contribution.is_verified && <VerifiedCrowdfunderBadge />}
              </div>
            )}
            <CardDescription>Join others in this contribution group</CardDescription>
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

            <GroupRules group={contribution} />

            {contribution.account_number && (
              <>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <AccountNumberDisplay
                    accountNumber={contribution.account_number}
                    accountName={contribution.account_name || contribution.name}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    You can also transfer directly to this account ({contribution.bank_name || contribution.account_details?.bank_name || "Virtual Account"})
                  </p>
                </div>
                <Separator />
              </>
            )}

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
                  Minimum contribution: ₦{minContribution.toLocaleString()}
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
                  <RadioGroupItem value="public" id="share-public" />
                  <Label htmlFor="share-public" className="cursor-pointer">
                    Public (Your name will be visible)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anonymous" id="share-anonymous" />
                  <Label htmlFor="share-anonymous" className="cursor-pointer">
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
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <TransactionPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        title="Authorize Contribution"
        description={`Enter your 4-digit Transaction PIN to contribute to ${contribution.name}.`}
        amount={amount}
        confirmLabel="Contribute Now"
        pending={isLoading}
        onVerified={executeContribution}
      />
    </div>
  );
};

export default ContributeSharePage;
