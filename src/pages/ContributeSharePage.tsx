import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import ShareContribution from '@/components/contributions/ShareContribution';

const AccountNumberDisplay = ({ accountNumber, accountName }: { accountNumber: string | undefined, accountName: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber)
        .then(() => {
          setIsCopied(true);
          toast.success('Account number copied to clipboard!');
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => {
          console.error("Could not copy text: ", err);
          toast.error('Failed to copy account number');
        });
    } else {
      toast.error('Account number not available');
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
      <div>
        <h3 className="text-lg font-semibold">{accountName}</h3>
        <p className="text-sm text-muted-foreground">
          Account Number: {accountNumber || 'Not Available'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={isCopied}>
        {isCopied ? 'Copied!' : <><Copy className="h-4 w-4 mr-2" /> Copy</>}
      </Button>
    </div>
  );
};

const ContributeSharePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contributions } = useApp();
  const [contribution, setContribution] = useState<any>(null);

  useEffect(() => {
    if (id && contributions) {
      const foundContribution = contributions.find((c: any) => c.id === id);
      if (foundContribution) {
        setContribution(foundContribution);
      } else {
        toast.error("Contribution not found");
        navigate("/dashboard");
      }
    }
  }, [id, contributions, navigate]);

  if (!contribution) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading contribution details...
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card className="glass-card animate-slide-up">
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{contribution.name}</h1>
            <p className="text-muted-foreground">{contribution.description}</p>
          </div>

          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Contribution Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">Frequency</p>
                <p className="font-medium">{contribution.frequency}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {format(new Date(contribution.startDate), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Target Amount</p>
                <p className="font-medium">₦{contribution.targetAmount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Amount</p>
                <p className="font-medium">₦{contribution.currentAmount}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Share & Contribute</h2>
            <p className="text-muted-foreground mb-4">
              Share this contribution group with others or contribute directly.
            </p>

            <div className="flex flex-col space-y-4">
              <ShareContribution
                contributionId={contribution.id}
                contributionName={contribution.name}
              />

              {contribution.accountReference && (
                <AccountNumberDisplay
                  accountNumber={contribution.accountNumber}
                  accountName={contribution.name}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContributeSharePage;
