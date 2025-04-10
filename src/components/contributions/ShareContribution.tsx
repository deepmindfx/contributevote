
import React, { useState } from 'react';
import {
  EmailShareButton,
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  EmailIcon,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
} from 'react-share';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Share } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ShareContributionProps {
  contributionId: string;
  title: string;
  description?: string;
  shareCode?: string;
  shareUrl?: string;
}

const ShareContribution = ({ contributionId, title, description, shareCode, shareUrl }: ShareContributionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const shareTitle = `Join ${title} contribution on Crowdfund`;
  const shareDesc = description || `Help us reach our goal for ${title}. Join the contribution`;
  
  // Calculate share URL
  const defaultShareUrl = `${window.location.origin}/share/${contributionId}`;
  const shareLink = shareUrl || defaultShareUrl;
  
  // Copy share URL to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).then(
      () => {
        toast.success('Link copied to clipboard!');
      },
      (err) => {
        toast.error('Failed to copy link');
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  // Copy share code to clipboard
  const copyCodeToClipboard = () => {
    if (!shareCode) {
      toast.error('Share code not available');
      return;
    }
    
    navigator.clipboard.writeText(shareCode).then(
      () => {
        toast.success('Code copied to clipboard!');
      },
      (err) => {
        toast.error('Failed to copy code');
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this contribution</DialogTitle>
          <DialogDescription>
            Share this link with others to allow them to contribute
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 mt-4">
          <div className="grid flex-1 gap-2">
            <Input
              value={shareLink}
              readOnly
              className="w-full"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="px-3"
            onClick={copyToClipboard}
          >
            <span className="sr-only">Copy</span>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        
        {shareCode && (
          <div className="flex items-center space-x-2 mt-2">
            <div className="grid flex-1 gap-2">
              <div className="text-sm mb-1">Or share the code:</div>
              <Input
                value={shareCode}
                readOnly
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="px-3"
              onClick={copyCodeToClipboard}
            >
              <span className="sr-only">Copy</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="mt-4">
          <div className="text-sm mb-2">Share via:</div>
          <div className="flex space-x-2">
            <WhatsappShareButton url={shareLink} title={shareTitle}>
              <WhatsappIcon size={32} round />
            </WhatsappShareButton>
            
            <FacebookShareButton url={shareLink} quote={shareTitle}>
              <FacebookIcon size={32} round />
            </FacebookShareButton>
            
            <TwitterShareButton url={shareLink} title={shareTitle}>
              <TwitterIcon size={32} round />
            </TwitterShareButton>
            
            <EmailShareButton url={shareLink} subject={shareTitle} body={shareDesc}>
              <EmailIcon size={32} round />
            </EmailShareButton>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <Link to={`/share/${contributionId}`} onClick={() => setIsOpen(false)}>
            <Button variant="link">View Share Page</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareContribution;
