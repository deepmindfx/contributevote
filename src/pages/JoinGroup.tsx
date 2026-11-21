import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Target, Calendar, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { GroupJoinService } from '@/services/supabase/groupJoinService';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import BrandLoader from '@/components/ui/BrandLoader';

export default function JoinGroup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSupabaseUser();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (id) {
      loadGroupInfo();
    }
  }, [id]);

  const loadGroupInfo = async () => {
    try {
      const groupData = await GroupJoinService.getPublicGroupInfo(id!);
      if (groupData) {
        setGroup(groupData);
      } else {
        toast.error('Group not found or is not public');
      }
    } catch (error) {
      console.error('Error loading group:', error);
      toast.error('Failed to load group information');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to join this group');
      navigate(`/auth?redirect=/join/${id}`);
      return;
    }

    setJoining(true);
    try {
      const result = await GroupJoinService.joinGroup(user.id, id!);
      if (result.success) {
        setJoined(true);
        setTimeout(() => {
          navigate(`/groups/${id}`);
        }, 2000);
      } else {
        toast.error(result.error || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-xl">
          <BrandLoader
            variant="page"
            message="Loading group information"
            submessage="Checking open contribution pool…"
          />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-xl">
          <Card className="max-w-md mx-auto p-12 text-center">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This group doesn't exist or is not available for public joining.
            </p>
            <Link to="/dashboard">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const progress = group.target_amount > 0 
    ? (group.current_amount / group.target_amount) * 100 
    : 0;

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <Header />
      <div className="app-page max-w-2xl">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="app-page-title mb-2">Join a group</h1>
            <p className="text-muted-foreground">
              You've been invited to join this public group
            </p>
          </div>

          {/* Group Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{group.name}</CardTitle>
                  <CardDescription className="text-base">
                    {group.description}
                  </CardDescription>
                </div>
                <Badge variant="default" className="bg-green-600">
                  Public
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    ₦{group.current_amount?.toLocaleString() || '0'} / ₦{group.target_amount?.toLocaleString() || '0'}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progress.toFixed(1)}% funded</span>
                  <span>₦{((group.target_amount || 0) - (group.current_amount || 0)).toLocaleString()} remaining</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <Target className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Target</p>
                    <p className="text-lg font-semibold">
                      ₦{group.target_amount?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <Users className="h-8 w-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="text-lg font-semibold">
                      {Array.isArray(group.contributors)
                        ? (group.contributors[0]?.count ?? group.contributors.length)
                        : 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <Calendar className="h-8 w-8 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="text-lg font-semibold capitalize">
                      {group.frequency || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Join Button */}
              {joined ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Successfully Joined!</h3>
                  <p className="text-muted-foreground mb-4">
                    Redirecting to group page...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <Users className="h-5 w-5 mr-2" />
                        Join This Group
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By joining, you agree to contribute and participate in group decisions
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                What happens when you join?
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>You'll become a member of this group</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>You can contribute to the group's goal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Voting rights granted after your first contribution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Participate in group decisions and governance</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
