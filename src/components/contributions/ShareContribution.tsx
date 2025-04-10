import React, { useState, useEffect } from 'react';
import {
  FacebookShareButton,
  FacebookIcon,
  TwitterShareButton,
  TwitterIcon,
  WhatsappShareButton,
  WhatsappIcon,
  TelegramShareButton,
  TelegramIcon,
  EmailShareButton,
  EmailIcon,
  LinkedinShareButton,
  LinkedinIcon,
} from 'react-share';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { useApp } from '@/contexts/AppContext';
import { useParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Copy, Check } from 'lucide-react';

interface ShareContributionProps {
  contributionId: string;
  shareUrl: string;
  title: string;
  description: string;
}

const ShareContribution: React.FC<ShareContributionProps> = ({ contributionId, shareUrl, title, description }) => {
  const { markNotificationAsRead } = useApp();
  const [isCopied, setIsCopied] = useState(false);
  const [open, setOpen] = React.useState(false)
  const params = useParams();
  const contributionID = params.contributionId;
  const [contribution, setContribution] = useState<any>(null);
  const { contributions, user } = useApp();

  useEffect(() => {
    if (contributions && contributionID) {
      const foundContribution = contributions.find((c: any) => c.id === contributionID);
      setContribution(foundContribution);
    }
  }, [contributions, contributionID]);

  const handleCopyClick = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy link: ", err);
        toast.error("Failed to copy link to clipboard.");
      });
  };

  const handleShareToContacts = () => {
    if (navigator.share) {
      navigator.share({
        title: title,
        text: description,
        url: shareUrl,
      }).then(() => {
        toast.success("Shared successfully!");
      }).catch((error) => {
        console.error("Error sharing:", error);
        toast.error("Sharing failed.");
      });
    } else {
      toast.warn("Web Share API not supported.");
    }
  };

  // Function to handle marking notification as read and navigating
  const handleNotificationClick = (notification: any) => {
    if (notification && markNotificationAsRead) {
      markNotificationAsRead(notification.id);
      window.location.href = `/groups/${contributionId}`;
    }
  };

  // Find unread notification related to this contribution
  const unreadNotification = user?.notifications?.find(
    (notification: any) => !notification.read && notification.relatedId === contributionId
  );

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full bg-[#2DAE75] hover:bg-[#249e69]">Share Contribution</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Share this contribution</DialogTitle>
            <DialogDescription>
              Share this contribution with your friends and family.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-center space-x-3">
              <FacebookShareButton url={shareUrl} quote={title}>
                <FacebookIcon size={40} round />
              </FacebookShareButton>
              <TwitterShareButton url={shareUrl} title={title}>
                <TwitterIcon size={40} round />
              </TwitterShareButton>
              <WhatsappShareButton url={shareUrl} title={title}>
                <WhatsappIcon size={40} round />
              </WhatsappShareButton>
              <TelegramShareButton url={shareUrl} title={title}>
                <TelegramIcon size={40} round />
              </TelegramShareButton>
              <EmailShareButton url={shareUrl} subject={title} body={description}>
                <EmailIcon size={40} round />
              </EmailShareButton>
              <LinkedinShareButton url={shareUrl} title={title} summary={description} source={window.location.origin}>
                <LinkedinIcon size={40} round />
              </LinkedinShareButton>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" className="w-full" onClick={handleCopyClick} disabled={isCopied}>
                {isCopied ? (
                  <><Check className="mr-2 h-4 w-4" /> Copied!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> Copy Link</>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Button className="w-full" onClick={handleShareToContacts}>
                Share to Contacts
              </Button>
            </div>
            {unreadNotification && (
              <div
                className="p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => {
                  setOpen(false);
                  handleNotificationClick(unreadNotification);
                }}
              >
                You have a new notification for this contribution!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShareContribution;
