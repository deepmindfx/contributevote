import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Check, Building2, Info, Download, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectiPayMark } from '@/components/ui/BrandLoader';

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
  accountName,
}: ShareableBankCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const shareText = `Contribute to "${groupName}" on CollectiPay

Bank Transfer Details:
Account Number: ${accountNumber}
Bank: ${bankName}
Account Name: ${accountName || groupName}

Powered by CollectiPay — https://collectipay.com.ng`;

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareToTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://collectipay.com.ng')}&quote=${encodeURIComponent(shareText)}`,
      '_blank'
    );
  };

  const downloadAsImage = async () => {
    if (!cardRef.current) return;

    setIsGeneratingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        logging: false,
        useCORS: true,
      });

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
          toast.success('Bank card image saved');
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
        scale: 3,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `${groupName}_bank_details.png`, { type: 'image/png' });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: `Contribute to ${groupName}`,
                text: 'Bank transfer details',
              });
              toast.success('Shared successfully');
            } catch (error: any) {
              if (error?.name !== 'AbortError') {
                console.error('Error sharing:', error);
                toast.error('Failed to share image');
              }
            }
          } else {
            await downloadAsImage();
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
    <Card ref={cardRef} className="overflow-hidden rounded-[1.35rem] border bg-card shadow-sm">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Dedicated Group Account
            </h3>
            <p className="truncate text-xs text-muted-foreground">{groupName}</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Active
        </span>
      </div>

      {/* Body */}
      <div className="space-y-4 p-3 sm:p-5">
        {/* Tap-to-copy Account Number Hero Box */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-accent/45 px-3 py-3.5 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Account Number
            </p>
            <p className="mt-0.5 break-all font-mono text-lg font-bold tracking-[0.06em] text-foreground tabular-nums sm:text-2xl">
              {accountNumber}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => copyToClipboard(accountNumber, 'Account number')}
            className="h-10 shrink-0 rounded-xl bg-card px-3.5 font-semibold shadow-sm hover:bg-card/80"
          >
            {copiedField === 'Account number' ? (
              <>
                <Check className="mr-1.5 h-4 w-4 text-primary" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4 text-primary" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Bank & Account Name Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/35 px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bank Name
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{bankName}</p>
          </div>
          <div className="rounded-xl border bg-muted/35 px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Account Name
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {accountName || groupName}
            </p>
          </div>
        </div>

        {/* Subtle Verification Note */}
        <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Transfers from external bank apps credit this pool automatically. In-app wallet contributions grant instant voting rights.
          </p>
        </div>

        {/* Action Row */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button
            type="button"
            onClick={() => copyToClipboard(shareText, 'Account details')}
            variant="outline"
            className="h-11 rounded-xl font-semibold"
          >
            {copiedField === 'Account details' ? (
              <Check className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy all
          </Button>

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="h-11 rounded-xl font-semibold">
                <Share2 className="mr-2 h-4 w-4" />
                Share card
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Group Account</DialogTitle>
                <DialogDescription>
                  Send bank transfer details as text or a crisp card image.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="text" className="w-full">
                <TabsList className="app-segmented grid w-full grid-cols-2">
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="image">Image Card</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-2.5 pt-4">
                  <Button
                    onClick={shareToWhatsApp}
                    className="h-11 w-full rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A]"
                  >
                    Share on WhatsApp
                  </Button>
                  <Button
                    onClick={shareToTwitter}
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                  >
                    Share on X / Twitter
                  </Button>
                  <Button
                    onClick={shareToFacebook}
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                  >
                    Share on Facebook
                  </Button>
                </TabsContent>

                <TabsContent value="image" className="space-y-2.5 pt-4">
                  <Button
                    onClick={downloadAsImage}
                    disabled={isGeneratingImage}
                    className="h-11 w-full rounded-xl"
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isGeneratingImage ? 'Generating image…' : 'Save card image'}
                  </Button>
                  <Button
                    onClick={shareAsImage}
                    disabled={isGeneratingImage}
                    className="h-11 w-full rounded-xl"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {isGeneratingImage ? 'Generating image…' : 'Share card image'}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {/* Crisp Vector Branding Footer */}
        <div className="flex items-center justify-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <CollectiPayMark size={18} />
          <span>
            Secured by <strong className="font-semibold text-foreground">CollectiPay</strong>
          </span>
        </div>
      </div>
    </Card>
  );
}
