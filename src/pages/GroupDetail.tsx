import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, Edit, Trash, Building, Clipboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from 'sonner';
import { deleteContribution } from '@/services/contributionIntegration';

// Define a new interface for group account details from Monnify
interface MonnifyAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  accountReference?: string;
  accounts?: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
}

const GroupDetail = () => {
  const { contributionId } = useParams<{ contributionId: string }>();
  const { user, contributions, refreshData, isAdmin } = useApp();
  const [contribution, setContribution] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (contributionId && contributions) {
      const foundContribution = contributions.find((c) => c.id === contributionId);
      setContribution(foundContribution);
      setIsLoading(false);
    }
  }, [contributionId, contributions]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  const handleDeleteContribution = async () => {
    if (!contributionId) {
      toast.error("Contribution ID is missing.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteContribution(contributionId);
      toast.success("Group deleted successfully.");
      navigate('/dashboard');
      refreshData();
    } catch (error) {
      console.error("Error deleting contribution:", error);
      toast.error("Failed to delete group. Please try again.");
    }
  };

  const renderContributionDetails = () => {
    if (isLoading) {
      return <CardContent className="p-4"><Skeleton className="h-[200px] w-full" /></CardContent>;
    }

    if (!contribution) {
      return <CardContent className="p-4">Contribution not found.</CardContent>;
    }

    return (
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold">Details</h3>
          <p className="text-muted-foreground">
            Created on {formatDate(contribution.createdAt)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Name</label>
            <div className="font-medium">{contribution.name}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Description</label>
            <div className="font-medium">{contribution.description}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Target Amount</label>
            <div className="font-medium">₦{contribution.targetAmount.toLocaleString()}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Contribution Frequency</label>
            <div className="font-medium">{contribution.contributionFrequency}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Contribution Amount</label>
            <div className="font-medium">₦{contribution.contributionAmount.toLocaleString()}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Start Date</label>
            <div className="font-medium">{formatDate(contribution.startDate)}</div>
          </div>
        </div>
      </CardContent>
    );
  };

  const renderContributors = () => {
    if (isLoading) {
      return <CardContent className="p-4"><Skeleton className="h-[200px] w-full" /></CardContent>;
    }

    if (!contribution || !contribution.contributors) {
      return <CardContent className="p-4">No contributors found.</CardContent>;
    }

    return (
      <CardContent className="space-y-3 p-4">
        <h3 className="text-lg font-semibold">Contributors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {contribution.contributors.map((contributor: any) => (
            <div key={contributor.userId} className="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src={`https://avatar.vercel.sh/${contributor.userId}.png`} />
                <AvatarFallback>{contributor.name ? contributor.name[0] : 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium leading-none">{contributor.name || `User ${contributor.userId.slice(0, 6)}`}</p>
                <p className="text-sm text-muted-foreground">
                  Joined: {formatDate(contributor.joinedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    );
  };

  // Inside the GroupDetail component, add this function:
  const renderGroupAccountDetails = () => {
    // Check if we have Monnify account details
    const hasMonnifyAccount = contribution && 
      (contribution.accountNumber || 
      (contribution.accountDetails && typeof contribution.accountDetails === 'object'));
    
    if (!hasMonnifyAccount) {
      return (
        <div className="p-4 text-center">
          <p className="text-muted-foreground">No account details available</p>
        </div>
      );
    }
    
    // Get account details - prioritize the accountDetails object if it exists
    const accountDetails: MonnifyAccount = contribution.accountDetails || {
      accountNumber: contribution.accountNumber || '',
      accountName: contribution.name || '',
      bankName: contribution.bankName || 'CollectiPay Bank'
    };
    
    const accountNumber = accountDetails.accountNumber || 
      (accountDetails.accounts && accountDetails.accounts.length > 0 ? 
        accountDetails.accounts[0].accountNumber : '');
        
    const bankName = accountDetails.bankName || 
      (accountDetails.accounts && accountDetails.accounts.length > 0 ? 
        accountDetails.accounts[0].bankName : '');
    
    return (
      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Account Number</label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                navigator.clipboard.writeText(accountNumber);
                toast.success("Account number copied to clipboard");
              }}
              className="h-6 px-2"
            >
              <Clipboard size={14} />
            </Button>
          </div>
          <div className="font-mono text-xl bg-muted/50 rounded-md py-2 px-3">
            {accountNumber}
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
          </div>
          <div className="font-medium text-lg bg-muted/50 rounded-md py-2 px-3">
            {bankName}
          </div>
        </div>
        
        <div className="pt-1">
          <label className="text-sm font-medium text-muted-foreground block mb-1">Account Name</label>
          <div className="font-medium text-lg">
            {accountDetails.accountName}
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">
          Transfer to this account from any bank to fund this group contribution.
        </p>
      </div>
    );
  };

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {isLoading ? <Skeleton className="h-6 w-48" /> : contribution?.name || 'Loading...'}
          </h1>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/edit-group/${contributionId}`)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500" onClick={handleDeleteContribution}>
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardContent>

        {renderContributionDetails()}
      </Card>

      <Card className="mt-6">
        {renderContributors()}
      </Card>

      {/* Account Details Section */}
      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="account-details">
          <AccordionTrigger className="text-lg font-medium">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Account Details
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {renderGroupAccountDetails()}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default GroupDetail;
