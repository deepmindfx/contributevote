
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2 } from 'lucide-react';
import { getContributionDetails } from '@/services/contributionIntegration';
import { toast } from 'sonner';

// This component displays sharing options for a contribution
export const ShareContribution = ({ contributionId }: { contributionId: string[] }) => {
  const id = contributionId?.[0] || '';
  const contribution = getContributionDetails(id);
  
  if (!contribution) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Contribution Not Found</CardTitle>
          <CardDescription>The contribution you're looking for doesn't exist or has been removed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  const shareContribution = () => {
    const shareUrl = `${window.location.origin}/contribute/share/${contribution.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Join ${contribution.groupName} contribution`,
        text: `I'm inviting you to join the ${contribution.groupName} contribution group!`,
        url: shareUrl,
      }).catch(error => {
        console.error('Error sharing:', error);
        fallbackShare(shareUrl);
      });
    } else {
      fallbackShare(shareUrl);
    }
  };
  
  const fallbackShare = (shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Link copied to clipboard! You can share it with your friends.');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      toast.error('Could not copy link. Please try again.');
    });
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Share {contribution.groupName}</CardTitle>
        <CardDescription>Invite others to join this contribution group</CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Share this contribution with friends and family so they can join. 
          Each person who joins will help reach the goal faster!
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md mb-4">
          <p className="font-medium">Contribution Details:</p>
          <p>Group: {contribution.groupName}</p>
          <p>Goal: ₦{contribution.amount.toLocaleString()}</p>
          <p>Frequency: {contribution.frequency}</p>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={shareContribution}
          className="w-full"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share Contribution
        </Button>
      </CardFooter>
    </Card>
  );
};
