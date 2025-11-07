import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Target, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { ContributeButton } from '@/components/contribution/ContributeButton';
import { ContributorsList } from '@/components/contribution/ContributorsList';
import { GroupAdminPanel } from '@/components/contribution/GroupAdminPanel';
import { VotingRightsGuard } from '@/components/contribution/VotingRightsGuard';
import { useVotingRights } from '@/hooks/useVotingRights';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<any>(null);
  const { user } = useSupabaseUser();
  const { contributions, loading, refreshContributionData } = useSupabaseContribution();
  const { canVote, isAdmin, loading: rightsLoading } = useVotingRights(id);

  useEffect(() => {
    if (id && contributions.length > 0) {
      const foundGroup = contributions.find((c: any) => c.id === id);
      if (foundGroup) {
        setGroup(foundGroup);
      } else {
        // Group not found in user's contributions, might not have access
        setGroup(null);
      }
    }
  }, [id, contributions]);

  const handleContributeSuccess = async () => {
    await refreshContributionData(); // Refresh group data
    toast.success('Thank you for contributing!');
  };

  if (loading || rightsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading group details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!group && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="container mx-auto p-6">
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">😕</div>
            <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The group you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/dashboard">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
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

  const isActive = group.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <div className="container mx-auto p-6 space-y-6">
        {/* Back Button */}
        <Link to="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Group Header */}
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{group.name}</h1>
                  <Badge variant={isActive ? 'default' : 'secondary'}>
                    {group.status}
                  </Badge>
                  {canVote && (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                      ✅ Can Vote
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{group.description}</p>
              </div>

              {isActive && (
                <ContributeButton
                  groupId={id!}
                  groupName={group.name}
                  onSuccess={handleContributeSuccess}
                />
              )}
            </div>

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Target</p>
                  <p className="text-lg font-semibold">
                    ₦{group.target_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Raised</p>
                  <p className="text-lg font-semibold text-green-600">
                    ₦{group.current_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="text-lg font-semibold">
                    {group.deadline ? new Date(group.deadline).toLocaleDateString() : 'No deadline'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Details */}
        {group.account_number && (
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Bank Transfer Details
              </CardTitle>
              <CardDescription>
                Transfer directly to this account number
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="text-lg font-mono font-semibold">{group.account_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Name</p>
                  <p className="text-lg font-semibold">{group.bank_name || 'Sterling Bank'}</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Bank transfers require admin verification for voting rights
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voting Section - Protected */}
        <VotingRightsGuard
          groupId={id!}
          groupName={group.name}
          onContributeSuccess={handleContributeSuccess}
        >
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                🗳️ Vote on Group Decisions
              </h2>
              <p className="text-muted-foreground">
                You have voting rights in this group. Participate in important decisions.
              </p>
              <Button variant="outline">
                View Active Polls
              </Button>
            </div>
          </Card>
        </VotingRightsGuard>

        {/* Contributors List */}
        <ContributorsList groupId={id!} />

        {/* Admin Panel */}
        {isAdmin && (
          <GroupAdminPanel groupId={id!} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
