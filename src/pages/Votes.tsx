import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { WithdrawalRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const Votes = () => {
  const { user, contributions, vote: voteOnWithdrawalRequest, refreshData, pingMembersForVote, isGroupCreator } = useApp();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [reason, setReason] = useState('');
  
  useEffect(() => {
    fetchRequests();
  }, [user, contributions]);
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 mr-2" />;
      case 'approved': return <CheckCircle className="h-4 w-4 mr-2" />;
      case 'rejected': return <AlertCircle className="h-4 w-4 mr-2" />;
      case 'expired': return <AlertCircle className="h-4 w-4 mr-2" />;
      default: return null;
    }
  };
  
  const canVote = (request: any) => {
    // Check if the user is a member of the contribution group and hasn't voted yet
    return request.hasContributed && !request.hasVoted && request.status === 'pending';
  };
  
  const isExpired = (request: any) => {
    return request.status === 'expired';
  };
  
  const isRequester = (request: any) => {
    return request.requesterId === user.id;
  };
  
  const openDialog = (request: any) => {
    setSelectedRequest(request);
    setIsDialogOpen(true);
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedRequest(null);
    setReason('');
  };

  // Fix the getWithdrawalRequests function usage
  const fetchRequests = () => {
    setIsLoading(true);
    try {
      // Get all withdrawal requests
      // @ts-ignore
      const allRequests = useApp().withdrawalRequests;
    
      // Format requests with additional info for UI
      const formattedRequests = allRequests.map(request => {
        const contribution = contributions.find(c => c.id === request.contributionId);
        return {
          ...request,
          contributionName: contribution ? contribution.name : 'Unknown',
          hasContributed: contribution ? contribution.members.includes(user.id) : false,
          hasVoted: request.votes.some(v => v.userId === user.id),
          userVote: request.votes.find(v => v.userId === user.id)?.vote || null
        };
      });
    
      setRequests(formattedRequests);
    } catch (error) {
      toast.error("Failed to load withdrawal requests");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the voteOnWithdrawalRequest function usage
  const handleVote = (requestId: string, vote: 'approve' | 'reject') => {
    try {
      // Submit vote
      voteOnWithdrawalRequest(requestId, vote);
      refreshData();
    
      // Update local state
      // @ts-ignore
      const updatedRequests = useApp().withdrawalRequests;
      const formattedRequests = updatedRequests.map(request => {
        const contribution = contributions.find(c => c.id === request.contributionId);
        return {
          ...request,
          contributionName: contribution ? contribution.name : 'Unknown',
          hasContributed: contribution ? contribution.members.includes(user.id) : false,
          hasVoted: request.votes.some(v => v.userId === user.id),
          userVote: request.votes.find(v => v.userId === user.id)?.vote || null
        };
      });
    
      setRequests(formattedRequests);
      toast.success(`Vote submitted successfully`);
    } catch (error) {
      toast.error("Failed to submit vote");
      console.error(error);
    }
  };
  
  const handlePing = (requestId: string) => {
    try {
      pingMembersForVote(requestId);
    } catch (error) {
      toast.error("Failed to send reminders");
      console.error(error);
    }
  };

  return (
    <div>
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-semibold mb-6">Withdrawal Requests</h1>
        
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Request</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.purpose}</TableCell>
                    <TableCell>{request.contributionName}</TableCell>
                    <TableCell>₦{request.amount.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={`gap-2 ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canVote(request) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleVote(request.id, 'approve')} className="mr-2">Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => openDialog(request)}>Reject</Button>
                        </>
                      )}
                      {isExpired(request) && (
                        <Badge variant="secondary">Expired</Badge>
                      )}
                      {isRequester(request) && (
                        <Badge variant="secondary">Requested</Badge>
                      )}
                      {!canVote(request) && !isExpired(request) && !isRequester(request) && request.hasVoted && (
                        <Badge variant="secondary">Voted</Badge>
                      )}
                      {isGroupCreator(request.contributionId) && canVote(request) && (
                        <Button size="sm" variant="link" onClick={() => handlePing(request.id)}>Ping Members</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      
      {/* Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Withdrawal Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this withdrawal request? Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Reason
              </Label>
              <Textarea id="reason" className="col-span-3" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" onClick={() => {
              handleVote(selectedRequest.id, 'reject');
              closeDialog();
            }}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Votes;
