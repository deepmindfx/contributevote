import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Copy, Mail, X } from 'lucide-react';
import { InvitationService } from '@/services/supabase/invitationService';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InviteMembersDialogProps {
  groupId: string;
  groupName: string;
  userId: string;
  privacy: string;
}

export function InviteMembersDialog({ groupId, groupName, userId, privacy }: InviteMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [invitations, setInvitations] = useState<any[]>([]);

  const loadInvitations = async () => {
    const invites = await InvitationService.getGroupInvitations(groupId);
    setInvitations(invites);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadInvitations();
    }
  };

  const handleSendInvite = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await InvitationService.sendInvitation(groupId, userId, email);
      
      if (result.success && result.inviteLink) {
        setInviteLink(result.inviteLink);
        setEmail('');
        await loadInvitations();
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invitation link copied!');
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    await InvitationService.cancelInvitation(invitationId);
    await loadInvitations();
  };

  if (privacy === 'public') {
    return null; // Public groups don't need invitations
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Members to {groupName}</DialogTitle>
          <DialogDescription>
            Send invitations to join this {privacy} group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Send Invitation */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendInvite()}
              />
              <Button onClick={handleSendInvite} disabled={loading}>
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Invitation Link */}
          {inviteLink && (
            <div className="space-y-2 p-3 bg-muted rounded-md">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="text-sm"
                />
                <Button size="icon" variant="outline" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the invitee. It expires in 7 days.
              </p>
            </div>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="space-y-2">
              <Label>Pending Invitations</Label>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                <div className="space-y-2">
                  {invitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{invite.invitee_email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              invite.status === 'pending'
                                ? 'default'
                                : invite.status === 'accepted'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="text-xs"
                          >
                            {invite.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(invite.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {invite.status === 'pending' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
