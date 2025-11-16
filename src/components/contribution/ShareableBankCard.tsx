import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Share2, Check, Building2, CreditCard, AlertCircle, Download, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ShareableBankCardProps {
  groupName: string;
  accountNumber: string;
  bankName: string;
  accountName?: string;
}

export function ShareableBankCard({ 
  groupName, 
  accountNumber, 
  bankName,
  accountName 
}: ShareableBankCardProps) {
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const shareText = `💰 Contribute to "${groupName}"

🏦 Bank Transfer Details:
Account Number: ${accountNumber}
Bank: ${bankName}
Account Name: ${accountName || groupName}

Powered by Collectipay 🚀
https://collectipay.com.ng`;

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://collectipay.com.ng')}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const copyFullDetails = () => {
    copyToClipboard(shareText, 'Account details');
  };

  const downloadAsImage = async () => {
    if (!cardRef.current) return;

    setIsGeneratingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${groupName.replace(/\s+/g, '_')}_bank_details.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success('Image downloaded!');
        }
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const shareAsImage = async () => {
    if (!cardRef.current) return;

    setIsGeneratingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `${groupName}_bank_details.png`, { type: 'image/png' });
          
          if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `Contribute to ${groupName}`,
                text: 'Bank transfer details'
              });
              toast.success('Shared successfully!');
            } catch (error) {
              if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                toast.error('Failed to share image');
              }
            }
          } else {
            // Fallback: download the image
            downloadAsImage();
          }
        }
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Card ref={cardRef} className="overflow-hidden border-2 border-green-200 dark:border-green-900">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 md:p-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 flex-shrink-0" />
              <h3 className="font-semibold text-base md:text-lg">Bank Transfer Details</h3>
            </div>
            <p className="text-sm text-green-50 truncate">{groupName}</p>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 flex-shrink-0">
            <CreditCard className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>
      </div>

      {/* Account Details */}
      <div className="p-4 md:p-6 space-y-4 bg-gradient-to-br from-white to-green-50 dark:from-gray-950 dark:to-green-950/20">
        {/* Account Number */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Account Number
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-gray-900 border-2 border-green-200 dark:border-green-900 rounded-lg p-3 md:p-4">
              <p className="text-xl md:text-2xl font-bold font-mono tracking-wider text-green-700 dark:text-green-400">
                {accountNumber}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(accountNumber, 'Account number')}
              className="h-12 w-12 md:h-14 md:w-14 border-2 border-green-200 hover:bg-green-50 hover:border-green-300 flex-shrink-0"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <Copy className="h-5 w-5 text-green-600" />
              )}
            </Button>
          </div>
        </div>

        {/* Bank Name */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Bank Name
          </label>
          <div className="bg-white dark:bg-gray-900 border-2 border-green-200 dark:border-green-900 rounded-lg p-3 md:p-4">
            <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {bankName}
            </p>
          </div>
        </div>

        {/* Account Name */}
        {accountName && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Account Name
            </label>
            <div className="bg-white dark:bg-gray-900 border-2 border-green-200 dark:border-green-900 rounded-lg p-3 md:p-4">
              <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                {accountName}
              </p>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-200 dark:border-yellow-900 rounded-lg p-3 md:p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                Important Notice
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                Bank transfers require admin verification for voting rights. 
                Card/app payments grant automatic voting rights.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            onClick={copyFullDetails}
            variant="outline"
            className="flex-1 border-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Details
          </Button>
          
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 bg-green-600 hover:bg-green-700">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Account Details</DialogTitle>
                <DialogDescription>
                  Share this group's bank account details with others
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">As Text</TabsTrigger>
                  <TabsTrigger value="image">As Image</TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Share account details as text message
                  </p>
                  <Button
                    onClick={shareToWhatsApp}
                    className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </Button>
                  <Button
                    onClick={shareToTwitter}
                    className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    Twitter
                  </Button>
                  <Button
                    onClick={shareToFacebook}
                    className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </Button>
                </TabsContent>
                
                <TabsContent value="image" className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Download or share account details as an image
                  </p>
                  <Button
                    onClick={downloadAsImage}
                    disabled={isGeneratingImage}
                    className="w-full"
                    variant="outline"
                  >
                    {isGeneratingImage ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download as Image
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={shareAsImage}
                    disabled={isGeneratingImage}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isGeneratingImage ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Share as Image
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Perfect for WhatsApp, Instagram, and other social media
                  </p>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {/* Branding */}
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-green-200 dark:border-green-900">
          <p className="text-xs text-muted-foreground">Powered by</p>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            Collectipay
          </span>
        </div>
      </div>
    </Card>
  );
}
