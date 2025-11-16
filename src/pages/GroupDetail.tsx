import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Target, TrendingUp, Calendar, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { 
  archiveGroup,
  unarchiveGroup 
} from '@/services/supabase/groupEnhancementService';
import { ContributeButton } from '@/components/contribution/ContributeButton';
import { RecurringContributionDialog } from '@/components/contribution/RecurringContributionDialog';
import { ScheduledContributionDialog } from '@/components/contribution/ScheduledContributionDialog';
import { GroupRefundDialog } from '@/components/contribution/GroupRefundDialog';
import { RefundRequestsCard } from '@/components/contribution/RefundRequestsCard';
import { ContributorsList } from '@/components/contribution/ContributorsList';
import { GroupAdminPanel } from '@/components/contribution/GroupAdminPanel';
import { VotingRightsGuard } from '@/components/contribution/VotingRightsGuard';
import { useVotingRights } from '@/hooks/useVotingRights';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const { user } = useSupabaseUser();
  const { contributions, loading, refreshContributionData } = useSupabaseContribution();
  const { canVote, isAdmin, loading: rightsLoading } = useVotingRights(id);
  const [isArchiving, setIsArchiving] = useState(false);

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
    toast.success('Thank you for contributing!');
    
    // Refresh contribution data from context
    await refreshContributionData();
    
    // Small delay to ensure database has updated
    setTimeout(() => {
      // Force page reload to get fresh data
      window.location.reload();
    }, 500);
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this group? It will be hidden from the main list.')) return;
    
    setIsArchiving(true);
    try {
      await archiveGroup(group.id, user.id);
      toast.success('Group archived successfully');
      await refreshContributionData();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error archiving group:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to archive group');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    setIsArchiving(true);
    try {
      await unarchiveGroup(group.id, user.id);
      toast.success('Group unarchived successfully');
      await refreshContributionData();
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error unarchiving group:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unarchive group');
    } finally {
      setIsArchiving(false);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20 md:pb-6">
      <Header />
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 pt-20 md:pt-24">
        {/* Back Button */}
        <Link to="/dashboard">
          <Button variant="ghost" className="mb-2 md:mb-4" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Group Header */}
        <Card className="p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold">{group.name}</h1>
                  <Badge variant={isActive ? 'default' : 'secondary'}>
                    {group.status}
                  </Badge>
                  {group.archived && (
                    <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-950">
                      📦 Archived
                    </Badge>
                  )}
                  {canVote && (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                      ✅ Can Vote
                    </Badge>
                  )}
                </div>
                <p className="text-sm md:text-base text-muted-foreground">{group.description}</p>
              </div>

              <div className="space-y-3 w-full md:w-auto md:min-w-[280px]">
                {/* Primary Action - Contribute Button (Only if active) */}
                {isActive && (
                  <ContributeButton
                    groupId={id!}
                    groupName={group.name}
                    onSuccess={handleContributeSuccess}
                  />
                )}
                
                {/* Secondary Actions - Only for members with voting rights */}
                {isActive && canVote && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <RecurringContributionDialog
                      groupId={id!}
                      groupName={group.name}
                      onSuccess={handleContributeSuccess}
                    />
                    <ScheduledContributionDialog
                      groupId={id!}
                      groupName={group.name}
                      onSuccess={handleContributeSuccess}
                    />
                    <GroupRefundDialog
                      groupId={id!}
                      groupName={group.name}
                      onSuccess={handleContributeSuccess}
                    />
                  </div>
                )}
                
                {/* Admin Actions - Only for creators */}
                {group.creator_id === user?.id && (
                  <div className="pt-2 border-t">
                    {!group.archived ? (
                      <Button 
                        variant="outline" 
                        onClick={handleArchive}
                        disabled={isArchiving}
                        className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        size="sm"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {isArchiving ? 'Archiving...' : 'Archive Group'}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={handleUnarchive}
                        disabled={isArchiving}
                        className="w-full text-green-600 hover:text-green-700 hover:bg-green-50"
                        size="sm"
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        {isArchiving ? 'Unarchiving...' : 'Unarchive Group'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-xs sm:text-sm">
                  ₦{group.current_amount?.toLocaleString() || '0'} / ₦{group.target_amount?.toLocaleString() || '0'}
                </span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
                <span>{progress.toFixed(1)}% funded</span>
                <span className="truncate">₦{((group.target_amount || 0) - (group.current_amount || 0)).toLocaleString()} remaining</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <div className="flex items-center gap-3 p-3 md:p-4 rounded-lg border">
                <Target className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Target</p>
                  <p className="text-base md:text-lg font-semibold truncate">
                    ₦{group.target_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 md:p-4 rounded-lg border">
                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Raised</p>
                  <p className="text-base md:text-lg font-semibold text-green-600 truncate">
                    ₦{group.current_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 md:p-4 rounded-lg border sm:col-span-2 md:col-span-1">
                <Calendar className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Deadline</p>
                  <p className="text-base md:text-lg font-semibold truncate">
                    {group.deadline ? new Date(group.deadline).toLocaleDateString() : 'No deadline'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Details */}
        {group.account_number && (
          <Card className="p-4 md:p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                Bank Transfer Details
              </CardTitle>
              <CardDescription className="text-sm">
                Transfer directly to this account number
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Account Number</p>
                  <p className="text-base md:text-lg font-mono font-semibold break-all">{group.account_number}</p>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Bank Name</p>
                  <p className="text-base md:text-lg font-semibold">{group.bank_name || 'Sterling Bank'}</p>
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

        {/* Refund Requests - Shows voting interface if any refund requests exist */}
        <RefundRequestsCard groupId={id!} />

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
