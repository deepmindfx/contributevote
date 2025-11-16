import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Mail, Users, Lock } from 'lucide-react';
import { InvitationService } from '@/services/supabase/invitationService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSupabaseUser();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    setLoading(true);
    try {
      const result = await InvitationService.getInvitationByToken(token!);
      if (result.success && result.invitation) {
        setInvitation(result.invitation);
      } else {
        setError(result.error || 'Invitation not found');
      }
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to accept this invitation');
      navigate(`/auth?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    try {
      const result = await InvitationService.acceptInvitation(token!, user.id);
      if (result.success && result.groupId) {
        setAccepted(true);
        setTimeout(() => {
          navigate(`/groups/${result.groupId}`);
        }, 2000);
      } else {
        toast.error(result.error || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      toast.error('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto p-6 pt-24">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto p-6 pt-24">
          <Card className="max-w-md mx-auto p-12 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-6">
              {error || 'This invitation is no longer valid'}
            </p>
            <Button onClick={() => navigate('/discover')}>
              Browse Public Groups
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto p-6 pt-24">
          <Card className="max-w-md mx-auto p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Accepted!</h2>
            <p className="text-muted-foreground mb-4">
              Redirecting to group...
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20 md:pb-6">
      <Header />
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-6 pt-20 md:pt-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <Mail className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold mb-2">You're Invited!</h1>
            <p className="text-muted-foreground">
              You've been invited to join a private group
            </p>
          </div>

          {/* Invitation Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{invitation.group.name}</CardTitle>
                  <CardDescription className="text-base">
                    {invitation.group.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {invitation.group.privacy}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Inviter Info */}
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invited by</p>
                  <p className="font-medium">{invitation.inviter.name}</p>
                </div>
              </div>

              {/* Group Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Target Amount</p>
                  <p className="text-xl font-bold">
                    ₦{invitation.group.target_amount?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Frequency</p>
                  <p className="text-xl font-bold capitalize">
                    {invitation.group.frequency}
                  </p>
                </div>
              </div>

              {/* Accept Button */}
              <div className="space-y-4">
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By accepting, you'll become a member of this private group
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                About Private Groups
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Only invited members can view and join</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Hidden from public discovery</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Contribute and participate in group decisions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Voting rights granted after contribution</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
