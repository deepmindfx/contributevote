import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DollarSign, Users, Calendar } from 'lucide-react';

const ContributePage = () => {
  const { contributionId } = useParams();
  const navigate = useNavigate();
  const { user, contributions, contribute } = useApp();
  const [amount, setAmount] = useState('');
  const [contribution, setContribution] = useState(null);

  useEffect(() => {
    if (contributions && contributionId) {
      const foundContribution = contributions.find(c => c.id === contributionId);
      setContribution(foundContribution);
    }
  }, [contributions, contributionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!contributionId) {
      toast.error("Contribution ID is missing");
      return;
    }

    contribute(contributionId, Number(amount));
    toast.success(`Successfully contributed ₦${Number(amount).toLocaleString()}!`);
    navigate(`/group/${contributionId}`);
  };

  if (!contribution) {
    return <div>Loading contribution details...</div>;
  }

  const progressPercentage = Math.min(100, Math.round((contribution.currentAmount / contribution.targetAmount) * 100) || 0);

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{contribution.name}</CardTitle>
          <CardDescription>Contribute to this group</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (NGN)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Progress ({progressPercentage}%)
              </p>
              <p className="text-sm font-medium">
                ₦{contribution.currentAmount.toLocaleString()} of ₦{contribution.targetAmount.toLocaleString()}
              </p>
            </div>
            <Progress value={progressPercentage} />
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-1 inline" />
            {contribution.members.length} members
            <Calendar className="h-4 w-4 mx-2 inline" />
            Started on {format(new Date(contribution.startDate), 'MMM d, yyyy')}
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleSubmit}>
            Contribute <DollarSign className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ContributePage;
