
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, Download, Receipt, CalendarRange, ArrowUpRight, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFGenerator } from '@/utils/pdfGenerator';
import { ModernReceipt, useReceiptDownload, type ReceiptData } from '@/components/receipt/ModernReceipt';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContributionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributorId: string;
  contributorName: string;
  groupId: string;
  groupName?: string;
}

export function ContributionHistoryDialog({
  open,
  onOpenChange,
  contributorId,
  contributorName,
  groupId,
  groupName = 'Group',
}: ContributionHistoryDialogProps) {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadAsImage, downloadAsPDF } = useReceiptDownload(receiptRef);

  useEffect(() => {
    if (open && contributorId) {
      loadContributions();
    }
  }, [open, contributorId]);

  const loadContributions = async () => {
    try {
      setLoading(true);
      
      // Get contributor details
      const { data: contributor, error: contributorError } = await supabase
        .from('contributors')
        .select('user_id, join_method, metadata, total_contributed, contribution_count, joined_at')
        .eq('id', contributorId)
        .single();

      if (contributorError || !contributor) {
        setContributions([]);
        return;
      }

      const contributorData = contributor as any;

      // For bank transfers without user_id
      if (!contributorData.user_id && contributorData.join_method === 'bank_transfer') {
        const syntheticTransaction = {
          id: contributorId,
          amount: contributorData.total_contributed,
          created_at: contributorData.joined_at,
          description: `Bank transfer from ${contributorData.metadata?.senderName || 'Unknown'}`,
          payment_method: 'bank_transfer',
          reference_id: `BANK_${contributorId.substring(0, 8)}`,
          status: 'completed',
          type: 'contribution',
          metadata: contributorData.metadata,
        };
        setContributions([syntheticTransaction]);
        return;
      }

      // For registered users
      if (contributorData.user_id) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', contributorData.user_id)
          .eq('contribution_id', groupId)
          .in('type', ['contribution', 'deposit'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        setContributions(data || []);
      } else {
        setContributions([]);
      }
    } catch (error) {
      console.error('Error loading contribution history:', error);
      setContributions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownloadSingleReceipt = (contribution: any) => {
    const receiptData: ReceiptData = {
      refNumber: contribution.reference_id || `TX_${contribution.id.substring(0, 12)}`,
      paymentTime: formatDate(contribution.created_at) + ', ' + formatTime(contribution.created_at),
      paymentMethod: (contribution.payment_method || 'Unknown').replace('_', ' '),
      senderName: contributorName,
      amount: contribution.amount.toLocaleString(),
      currency: '₦',
      groupName: groupName,
      description: contribution.description || undefined,
    };

    setSelectedReceipt(receiptData);
    setShowReceiptModal(true);
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      await downloadAsPDF();
      toast.success('Receipt downloaded as PDF!');
      setShowReceiptModal(false);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = async () => {
    try {
      setIsGenerating(true);
      await downloadAsImage();
      toast.success('Receipt downloaded as image!');
      setShowReceiptModal(false);
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadFullReport = () => {
    try {
      setIsGenerating(true);
      const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);
      PDFGenerator.generateFullReport({
        contributorName,
        groupName,
        groupId,
        contributions,
        totalAmount,
        contributionCount: contributions.length,
      });
      toast.success('Full report downloaded successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Group contributions by month/year
  const groupedContributions = contributions.reduce((acc: any, contribution) => {
    const date = new Date(contribution.created_at);
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(contribution);
    return acc;
  }, {});

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md md:max-w-lg p-0 gap-0 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-xl border-white/20 overflow-hidden shadow-2xl">
          {/* Header Area */}
          <div className="p-6 bg-white dark:bg-zinc-900 border-b border-border/50">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Contribution History
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {contributorName} • {groupName}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Receipt className="h-5 w-5" />
              </div>
            </div>

            {!loading && contributions.length > 0 && (
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Contributed</p>
                  <p className="text-lg font-bold text-foreground">
                    ₦{contributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={handleDownloadFullReport}
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  className="h-8 bg-white dark:bg-zinc-900 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Report
                </Button>
              </div>
            )}
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-8">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : contributions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarRange className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-semibold text-foreground">No history found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This contributor hasn't made any verified contributions yet.
                  </p>
                </div>
              ) : (
                Object.entries(groupedContributions).map(([dateGroup, items]: [string, any]) => (
                  <div key={dateGroup} className="relative">
                    <div className="sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur py-1 mb-4 border-b border-border/50">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {dateGroup}
                      </h4>
                    </div>
                    
                    <div className="relative space-y-6 pl-4 border-l border-border/50 ml-2">
                      {items.map((contribution: any) => (
                        <div key={contribution.id} className="relative group">
                          {/* Timeline Dot */}
                          <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background z-10 group-hover:scale-125 transition-transform" />
                          
                          <div className="flex items-start justify-between gap-4 pl-2">
                            <div className="space-y-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {contribution.description || 'Contribution'}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(contribution.created_at)}
                                </span>
                                <span>•</span>
                                <span className="capitalize">{contribution.payment_method?.replace('_', ' ') || 'Unknown'}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold text-sm">
                                ₦{contribution.amount.toLocaleString()}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                {contribution.status === 'completed' ? (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                                    Success
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                    {contribution.status}
                                  </Badge>
                                )}
                                
                                <Button
                                  onClick={() => handleDownloadSingleReceipt(contribution)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modern Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="max-w-sm p-0 bg-transparent border-none shadow-none sm:max-w-sm">
            <div className="relative">
              <ModernReceipt
                ref={receiptRef}
                data={selectedReceipt}
                onDownload={() => {}} // Handled by external buttons
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  onClick={handleDownloadImage}
                  disabled={isGenerating}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {isGenerating ? 'Saving...' : 'Save Image'}
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  disabled={isGenerating}
                  className="w-full bg-primary text-primary-foreground"
                >
                  {isGenerating ? 'Saving...' : 'Save PDF'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
