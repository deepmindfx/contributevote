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
import { Calendar, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContributionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributorId: string;
  contributorName: string;
  groupId: string;
}

export function ContributionHistoryDialog({
  open,
  onOpenChange,
  contributorId,
  contributorName,
  groupId,
}: ContributionHistoryDialogProps) {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && contributorId) {
      loadContributions();
    }
  }, [open, contributorId]);

  const loadContributions = async () => {
    try {
      setLoading(true);
      
      // Get contributor to find user_id
      const { data: contributor } = await supabase
        .from('contributors')
        .select('user_id')
        .eq('id', contributorId)
        .single();

      if (!contributor?.user_id) {
        setContributions([]);
        return;
      }

      // Get all transactions for this user in this group
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', contributor.user_id)
        .eq('contribution_id', groupId)
        .eq('type', 'deposit')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContributions(data || []);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contribution History</DialogTitle>
          <DialogDescription>
            All contributions by {contributorName}
          </DialogDescription>
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
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
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
                </div>

                {contribution.payment_method && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{contribution.payment_method}</span>
                    {contribution.reference_id && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{contribution.reference_id.substring(0, 16)}...</span>
                      </>
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
