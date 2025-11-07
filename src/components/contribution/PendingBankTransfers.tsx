import { useState, useEffect } from 'react';
import { ContributorService } from '@/services/supabase/contributorService';
import { GroupContributionService } from '@/services/supabase/groupContributionService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, User } from 'lucide-react';

interface PendingBankTransfersProps {
  groupId: string;
  isAdmin: boolean;
}

export function PendingBankTransfers({ groupId, isAdmin }: PendingBankTransfersProps) {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadPendingTransfers();
  }, [groupId]);

  const loadPendingTransfers = async () => {
    try {
      setLoading(true);
      const data = await ContributorService.getPendingBankTransfers(groupId);
      setPending(data);
    } catch (error) {
      console.error('Error loading pending transfers:', error);
      toast.error('Failed to load pending transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (contributorId: string, amount: number, grantVoting: boolean) => {
    const userId = selectedUserId[contributorId];
    if (!userId) {
      toast.error('Please enter a user ID');
      return;
    }

    try {
      setVerifying(contributorId);
      await GroupContributionService.verifyBankTransfer(
        groupId,
        contributorId,
        userId,
        amount,
        grantVoting
      );
      await loadPendingTransfers();
    } catch (error) {
      console.error('Error verifying transfer:', error);
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async (contributorId: string) => {
    try {
      setVerifying(contributorId);
      await ContributorService.removeContributor(contributorId);
      await loadPendingTransfers();
      toast.success('Transfer rejected');
    } catch (error) {
      console.error('Error rejecting transfer:', error);
    } finally {
      setVerifying(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  if (pending.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          No pending bank transfers to review
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pending Bank Transfers</h3>
      <p className="text-sm text-muted-foreground mb-4">
        These contributions were made via bank transfer and need manual verification.
        Link them to user accounts to grant voting rights.
      </p>

      <div className="space-y-4">
        {pending.map((transfer) => (
          <Card key={transfer.id} className="p-4 border-l-4 border-l-yellow-500">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    ₦{transfer.total_contributed.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transfer.metadata?.senderName || 'Unknown Sender'}
                  </p>
                  {transfer.metadata?.senderBank && (
                    <p className="text-xs text-muted-foreground">
                      {transfer.metadata.senderBank}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(transfer.joined_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`user-${transfer.id}`}>
                  Link to User (Enter User ID or Email)
                </Label>
                <Input
                  id={`user-${transfer.id}`}
                  placeholder="User ID or email"
                  value={selectedUserId[transfer.id] || ''}
                  onChange={(e) =>
                    setSelectedUserId({
                      ...selectedUserId,
                      [transfer.id]: e.target.value
                    })
                  }
                  disabled={verifying === transfer.id}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleVerify(transfer.id, transfer.total_contributed, true)}
                  disabled={verifying === transfer.id || !selectedUserId[transfer.id]}
                  className="flex-1"
                >
                  {verifying === transfer.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Verify & Grant Voting
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerify(transfer.id, transfer.total_contributed, false)}
                  disabled={verifying === transfer.id || !selectedUserId[transfer.id]}
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  Verify Only
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(transfer.id)}
                  disabled={verifying === transfer.id}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
