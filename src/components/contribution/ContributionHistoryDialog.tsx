import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CreditCard, CheckCircle, Clock, Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFGenerator } from '@/utils/pdfGenerator';
import { toast } from 'sonner';

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

      // Cast to any to avoid TypeScript issues with dynamic fields
      const contributorData = contributor as any;

      // For bank transfers without user_id, create a synthetic transaction from contributor data
      if (!contributorData.user_id && contributorData.join_method === 'bank_transfer') {
        // Bank transfer contributors don't have transactions linked to them
        // Create a display entry from the contributor record
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

      // For registered users, get all transactions
      if (contributorData.user_id) {
        // Get all transactions for this user in this group
        // Include both 'contribution' (wallet) and 'deposit' (card/bank) types
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

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const handleDownloadSingleReceipt = (contribution: any) => {
    try {
      setIsGenerating(true);
      PDFGenerator.generateSingleReceipt(contribution, contributorName, groupName);
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Contribution History</DialogTitle>
              <DialogDescription>
                All contributions by {contributorName}
              </DialogDescription>
            </div>
            {!loading && contributions.length > 0 && (
              <Button
                onClick={handleDownloadFullReport}
                disabled={isGenerating}
                size="sm"
                variant="outline"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : contributions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No contribution history found</p>
            </div>
          ) : (
            contributions.map((contribution) => (
              <div
                key={contribution.id}
                className="p-4 rounded-lg border bg-card space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        ₦{contribution.amount.toLocaleString()}
                      </span>
                      {getStatusBadge(contribution.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {contribution.description || 'Contribution'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(contribution.created_at)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(contribution.created_at)}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDownloadSingleReceipt(contribution)}
                      disabled={isGenerating}
                      size="sm"
                      variant="ghost"
                      className="h-8"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Receipt
                    </Button>
                  </div>
                </div>

                {contribution.payment_method && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{contribution.payment_method}</span>
                      {contribution.reference_id && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{contribution.reference_id.substring(0, 16)}...</span>
                        </>
                      )}
                    </div>
                    {contribution.payment_method === 'bank_transfer' && contribution.metadata && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {contribution.metadata.senderName && (
                          <div>Sender: {contribution.metadata.senderName}</div>
                        )}
                        {contribution.metadata.senderBank && (
                          <div>Bank: {contribution.metadata.senderBank}</div>
                        )}
                        {contribution.metadata.accountNumber && (
                          <div>Account: {contribution.metadata.accountNumber}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {!loading && contributions.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Contributions:</span>
                <span className="font-semibold text-lg">
                  ₦{contributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Number of Contributions:</span>
                <span className="font-medium">{contributions.length}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
