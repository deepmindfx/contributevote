import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from 'date-fns';
import { useApp } from "@/contexts/AppContext";
import { MoreVertical, Edit, Users, Calendar, Copy, UserPlus, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markNotificationAsRead } from '@/services/localStorage';

const GroupDetail = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const {
    user,
    users,
    groups,
    contributions,
    contribute,
    getShareLink,
    isGroupCreator,
    withdrawalRequests,
    vote,
    pingMembersForVote,
    refreshData
  } = useApp();
  const [contribution, setContribution] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<any>(null);
  
  useEffect(() => {
    if (groupId && contributions) {
      const foundContribution = contributions.find(c => c.id === groupId);
      setContribution(foundContribution);
    }
  }, [groupId, contributions]);
  
  useEffect(() => {
    if (groupId && user) {
      setIsCreator(isGroupCreator(groupId));
    }
  }, [groupId, user, isGroupCreator]);
  
  useEffect(() => {
    if (contribution) {
      setShareLink(getShareLink(contribution.id));
    }
  }, [contribution, getShareLink]);
  
  useEffect(() => {
    if (contribution && user) {
      // Find pending withdrawal request for the current user and contribution
      const foundWithdrawal = withdrawalRequests.find(
        req => req.contributionId === contribution.id && req.userId === user.id && req.status === 'pending'
      );
      setPendingWithdrawal(foundWithdrawal);
    }
  }, [contribution, user, withdrawalRequests]);
  
  const handleContribute = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (!contribution) {
      toast.error("Contribution not found");
      return;
    }
    
    setIsContributing(true);
    try {
      contribute(contribution.id, Number(amount));
      toast.success(`Successfully contributed ₦${amount} to ${contribution.name}`);
      setAmount('');
      // Refresh data to update the contribution details
      refreshData();
    } catch (error) {
      console.error("Contribution failed:", error);
      toast.error("Failed to contribute. Please try again.");
    } finally {
      setIsContributing(false);
    }
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };
  
  const getMemberAvatar = (memberId: string) => {
    const member = users.find(u => u.id === memberId);
    return member ? (
      <Avatar key={member.id}>
        <AvatarImage src={member.profileImage} alt={member.name} />
        <AvatarFallback>{member.firstName?.charAt(0)}{member.lastName?.charAt(0)}</AvatarFallback>
      </Avatar>
    ) : (
      <Avatar key={memberId}>
        <AvatarFallback>NA</AvatarFallback>
      </Avatar>
    );
  };
  
  const handleVote = (voteType: 'approve' | 'reject') => {
    if (pendingWithdrawal) {
      vote(pendingWithdrawal.id, voteType);
      toast.success(`You have ${voteType}d this request`);

      // Mark notification as read
      const notification = user?.notifications?.find(n => n.relatedId === pendingWithdrawal.id);
      if (notification) {
        markNotificationAsRead(notification.id);
      }
      
      refreshData();
    }
  };
  
  const handlePingMembers = () => {
    if (pendingWithdrawal) {
      pingMembersForVote(pendingWithdrawal.id);
      toast.info("Members have been pinged for their vote");
    }
  };
  
  if (!contribution) {
    return <div>Contribution not found</div>;
  }
  
  const progressPercentage = Math.min(100, Math.round((contribution.currentAmount / contribution.targetAmount) * 100) || 0);
  const isAdmin = user?.role === 'admin';
  const canVote = pendingWithdrawal && !pendingWithdrawal.votes.some(v => v.userId === user?.id);
  
  return (
    <div className="container max-w-5xl mx-auto px-4 pt-16 pb-8">
      <Card className="glass-card animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{contribution.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate(`/edit-group/${contribution.id}`)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit Group</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start">
                      Delete Group
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your group and remove all data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardDescription className="px-4 text-muted-foreground">
          {contribution.description}
        </CardDescription>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{contribution.members.length} Members</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Started on {format(new Date(contribution.startDate), 'MMM d, yyyy')}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Progress</h3>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted-foreground">
                  {progressPercentage}%
                </span>
                <span className="text-sm font-medium">
                  ₦{contribution.currentAmount.toLocaleString()} of ₦{contribution.targetAmount.toLocaleString()}
                </span>
              </div>
              <Progress value={progressPercentage} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Members</h3>
              <div className="flex -space-x-2 overflow-hidden">
                {contribution.members.map(memberId => getMemberAvatar(memberId))}
              </div>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-muted-foreground">
                  ₦
                </span>
                <Input
                  type="number"
                  id="amount"
                  placeholder="Enter amount"
                  className="pl-7"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button
                className="w-full mt-2 bg-[#2DAE75] hover:bg-[#249e69]"
                onClick={handleContribute}
                disabled={isContributing}
              >
                Contribute
              </Button>
            </div>
            <div>
              <Label>Share Link</Label>
              <div className="flex items-center">
                <Input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="cursor-not-allowed"
                />
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={handleCopyLink}
                  disabled={isLinkCopied}
                >
                  {isLinkCopied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {isLinkCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        {pendingWithdrawal ? (
          <CardFooter className="flex flex-col space-y-4">
            <div className="rounded-md border p-4 bg-amber-500/10">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="ml-2 text-sm font-semibold">Pending Withdrawal Request</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                There is a pending withdrawal request of ₦{pendingWithdrawal.amount.toLocaleString()} from this group.
                {canVote && <span> Your vote is required to process this request.</span>}
              </p>
            </div>
            {canVote ? (
              <div className="flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => handleVote('reject')}>Reject</Button>
                <Button onClick={() => handleVote('approve')}>Approve</Button>
              </div>
            ) : (
              <Button onClick={handlePingMembers} disabled={!isCreator && !isAdmin}>
                Ping Members for Vote
              </Button>
            )}
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
};

export default GroupDetail;
