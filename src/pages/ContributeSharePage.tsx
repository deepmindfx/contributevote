import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Copy, Check } from 'lucide-react';

const ContributeSharePage = () => {
  const { contributionId } = useParams<{ contributionId: string }>();
  const { user, contributions, contribute, markNotificationAsRead } = useApp();
  const navigate = useNavigate();
  const [contribution, setContribution] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (contributionId && contributions) {
      const foundContribution = contributions.find((c: any) => c.id === contributionId);
      setContribution(foundContribution);
    }
  }, [contributionId, contributions]);

  const handleContribute = () => {
    if (!contributionId) {
      toast.error('Contribution ID is missing.');
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    contribute(contributionId, Number(amount));
    toast.success(`Successfully contributed ₦${amount} to ${contribution?.name}`);
    navigate('/dashboard');
  };

  const handleCopyToClipboard = () => {
    if (contribution) {
      const shareLink = `${window.location.origin}/share/${contribution.id}`;
      navigator.clipboard.writeText(shareLink)
        .then(() => {
          setIsCopied(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setIsCopied(false), 3000);
        })
        .catch(err => {
          console.error("Could not copy text: ", err);
          toast.error('Failed to copy link to clipboard.');
        });
    }
  };

  if (!contribution) {
    return <div className="container mx-auto p-4">Contribution not found.</div>;
  }

  const progressPercentage = Math.min(100, Math.round((contribution.currentAmount / contribution.targetAmount) * 100) || 0);

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Contribute to {contribution.name}</CardTitle>
          <CardDescription>
            Join your friends in contributing to this group.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src={contribution.creator.profileImage} alt={contribution.creator.name} />
              <AvatarFallback>{contribution.creator.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">{contribution.creator.name}</p>
              <p className="text-sm text-muted-foreground">
                Created on {format(new Date(contribution.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (NGN)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {contribution.currentAmount} / {contribution.targetAmount} Contributed
          </p>
        </CardContent>
        <div className="flex flex-col space-y-2 p-4">
          <Button className="w-full bg-[#2DAE75] hover:bg-[#249e69]" onClick={handleContribute}>
            Contribute
          </Button>
          <Button variant="outline" className="w-full" onClick={handleCopyToClipboard} disabled={isCopied}>
            {isCopied ? (
              <div className="flex items-center justify-center">
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Copy className="mr-2 h-4 w-4" />
                Share Contribution
              </div>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ContributeSharePage;
