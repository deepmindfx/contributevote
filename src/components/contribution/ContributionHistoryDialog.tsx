import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Download, Receipt, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFGenerator } from '@/utils/pdfGenerator';
import { useReceiptDownload } from '@/components/receipt/ModernReceipt';
import CollectiPayReceipt, { type CollectiPayReceiptData } from '@/components/receipt/CollectiPayReceipt';
import BrandLoader from '@/components/ui/BrandLoader';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Database } from '@/integrations/supabase/types';

type HistoryEntry = Database['public']['Functions']['get_group_contribution_history']['Returns'][number];

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
  const [contributions, setContributions] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<CollectiPayReceiptData | null>(null);
  const [groupStats, setGroupStats] = useState<{ raised: number; target: number } | undefined>(undefined);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadAsPDF } = useReceiptDownload(receiptRef);

  useEffect(() => {
    if (!open || !contributorId) return;
    let active = true;
    setLoading(true);
    setContributions([]);
    setGroupStats(undefined);
    setSelectedReceipt(null);
    setShowReceiptModal(false);
    void Promise.all([
      supabase.rpc('get_group_contribution_history', { p_group_id: groupId, p_contributor_id: contributorId }),
      supabase.from('contribution_groups').select('current_amount, target_amount').eq('id', groupId).maybeSingle(),
    ]).then(([history, group]) => {
      if (!active) return;
      if (history.error) {
        toast.error('Couldn’t load contribution history.');
      } else {
        setContributions(history.data ?? []);
      }
      if (group.data && Number(group.data.target_amount) > 0) {
        setGroupStats({ raised: Number(group.data.current_amount ?? 0), target: Number(group.data.target_amount) });
      }
    }).catch(() => {
      if (active) toast.error('Couldn’t load contribution history.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, groupId, contributorId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenReceipt = (contribution: HistoryEntry) => {
    const methodLabel = String(contribution.payment_method || 'CollectiPay Wallet')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    setSelectedReceipt({
      kind: 'contribution',
      title: 'Group Contribution',
      amount: Number(contribution.amount || 0),
      status: contribution.status || 'completed',
      date: contribution.created_at,
      reference: contribution.reference_id || `TX-${String(contribution.id).slice(0, 12).toUpperCase()}`,
      groupName,
      groupProgress: groupStats,
      paymentMethod: methodLabel,
      narration: contribution.description || undefined,
      votingRightsGranted: contribution.voting_rights_granted,
      sender: {
        label: 'Contributor',
        name: contributorName,
        subtitle: methodLabel,
      },
      recipient: {
        label: 'To Pool',
        name: groupName,
        subtitle: 'Group Contribution Vault',
      },
    });
    setShowReceiptModal(true);
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      await downloadAsPDF();
      toast.success('Group receipt saved as PDF');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadFullReport = () => {
    try {
      setIsGenerating(true);
      const totalAmount = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      PDFGenerator.generateFullReport({
        contributorName,
        groupName,
        groupId,
        contributions,
        totalAmount,
        contributionCount: contributions.length,
      });
      toast.success('Full contribution report downloaded');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const groupedContributions = contributions.reduce<Record<string, HistoryEntry[]>>((acc, contribution) => {
    const date = new Date(contribution.created_at);
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(contribution);
    return acc;
  }, {});

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl md:max-w-lg">
          <div className="border-b bg-card p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Contribution History
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {contributorName} • {groupName}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <Receipt className="h-5 w-5" />
              </div>
            </div>

            {!loading && contributions.length > 0 && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Contributed
                  </p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    ₦{contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={handleDownloadFullReport}
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl bg-card shadow-sm"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  PDF Report
                </Button>
              </div>
            )}
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <BrandLoader variant="inline" message="Loading contributions…" />
                </div>
              ) : contributions.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                    <CalendarRange className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-semibold text-foreground">No history found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This contributor has not made any verified contributions yet.
                  </p>
                </div>
              ) : (
                Object.entries(groupedContributions).map(([dateGroup, items]) => (
                  <div key={dateGroup} className="relative">
                    <div className="sticky top-0 z-10 mb-4 border-b bg-card/95 py-1 backdrop-blur">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {dateGroup}
                      </h4>
                    </div>

                    <div className="relative ml-2 space-y-5 border-l border-border pl-4">
                      {items.map((contribution: HistoryEntry) => (
                        <div key={contribution.id} className="group relative">
                          <div className="absolute -left-[21px] top-1.5 z-10 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background transition-transform group-hover:scale-125" />

                          <div className="flex items-start justify-between gap-4 pl-2">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {contribution.description || 'Group Contribution'}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(contribution.created_at)}
                                </span>
                                <span>•</span>
                                <span className="capitalize">
                                  {contribution.payment_method?.replace(/_/g, ' ') || 'Wallet'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <span className="text-sm font-bold tabular-nums">
                                ₦{Number(contribution.amount || 0).toLocaleString()}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="h-5 border-primary/25 bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground"
                                >
                                  {contribution.status === 'completed' || contribution.status === 'successful'
                                    ? 'Success'
                                    : contribution.status}
                                </Badge>

                                <Button
                                  onClick={() => handleOpenReceipt(contribution)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-accent"
                                >
                                  <Receipt className="mr-1 h-3.5 w-3.5" />
                                  Receipt
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

      {/* Flagship CollectiPay Group Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto border-none bg-transparent p-2 shadow-none sm:p-4">
            <DialogHeader className="sr-only">
              <DialogTitle>Group Contribution Receipt</DialogTitle>
            </DialogHeader>
            <CollectiPayReceipt
              sheetRef={receiptRef}
              data={selectedReceipt}
              onDownloadPdf={handleDownloadPDF}
              onDone={() => setShowReceiptModal(false)}
              doneLabel="Done"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
