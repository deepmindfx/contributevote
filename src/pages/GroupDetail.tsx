import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Target, TrendingUp, Calendar, Archive, ArchiveRestore, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import { 
  archiveGroup,
  unarchiveGroup 
} from '@/services/supabase/groupEnhancementService';
import { createGroupVirtualAccount } from '@/services/flutterwave/virtualAccounts';
import { ContributeButton } from '@/components/contribution/ContributeButton';
import { RecurringContributionDialog } from '@/components/contribution/RecurringContributionDialog';
import { ScheduledContributionDialog } from '@/components/contribution/ScheduledContributionDialog';
import { GroupRefundDialog } from '@/components/contribution/GroupRefundDialog';
import { RefundRequestsCard } from '@/components/contribution/RefundRequestsCard';
import { ContributorsList } from '@/components/contribution/ContributorsList';
import { GroupAdminPanel } from '@/components/contribution/GroupAdminPanel';
import { VotingRightsGuard } from '@/components/contribution/VotingRightsGuard';
import { ShareableBankCard } from '@/components/contribution/ShareableBankCard';
import { ShareGroupButton } from '@/components/contribution/ShareGroupButton';
import { InviteMembersDialog } from '@/components/contribution/InviteMembersDialog';
import { BvnInputDialog } from '@/components/contribution/BvnInputDialog';
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
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showBvnDialog, setShowBvnDialog] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      if (!id) return;

      // First, try to find in contributions
      const foundGroup = contributions.find((c: any) => c.id === id);
      if (foundGroup) {
        setGroup(foundGroup);
        return;
      }

      // If not in contributions, fetch directly from database
      // This handles cases where user just joined the group
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase
          .from('contribution_groups')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        
        if (data) {
          setGroup(data);
          // Refresh contributions to include this new group
          await refreshContributionData();
        } else {
          setGroup(null);
        }
      } catch (error) {
        console.error('Error fetching group:', error);
        setGroup(null);
      }
    };

    fetchGroup();
  }, [id, contributions]);

  const handleContributeSuccess = async () => {
    toast.success('Thank you for contributing!');
    
    // Refresh contribution data from context
    await refreshContributionData();
    
    // Refresh the group data to show updated balance
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('contribution_groups')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setGroup(data);
      }
    } catch (error) {
      console.error('Error refreshing group:', error);
    }
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

  const handleSetupBankAccount = async (bvn: string) => {
    setIsCreatingAccount(true);
    try {
      const accountData = await createGroupVirtualAccount({
        email: user.email,
        bvn: bvn,
        groupName: group.name,
        groupId: group.id,
      });

      console.log('Virtual account created:', accountData);
      
      if (accountData.success) {
        toast.success('Bank account created successfully! Refreshing...');
        setShowBvnDialog(false);
        
        // Refresh the group data to show the new account
        await refreshContributionData();
        
        // Small delay to ensure data is synced
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reload the page to show the bank card
        window.location.reload();
      } else {
        toast.error(accountData.message || 'Failed to create bank account');
      }
    } catch (error) {
      console.error('Error creating virtual account:', error);
      toast.error('Failed to create bank account. Please try again.');
    } finally {
      setIsCreatingAccount(false);
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
        {/* Back Button and Share */}
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          {/* Share Button for Public Groups */}
          {group.privacy === 'public' && (
            <ShareGroupButton
              groupId={group.id}
              groupName={group.name}
              groupDescription={group.description || ''}
            />
          )}
          
          {/* Invite Members for Private Groups */}
          {group.privacy !== 'public' && group.creator_id === user.id && (
            <InviteMembersDialog
              groupId={group.id}
              groupName={group.name}
              userId={user.id}
              privacy={group.privacy}
            />
          )}
        </div>

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
                {/* Voting Rights Warning for Non-Voting Groups */}
                {!group.enable_voting_rights && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                      ⚠️ No Voting Rights
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Contributors to this group do not have voting rights. The admin can withdraw funds without approval.
                    </p>
                  </div>
                )}
                
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

        {/* Shareable Bank Account Card - Visible to ALL members */}
        {(group.account_number || group.bank_details?.accountNumber) ? (
          <ShareableBankCard
            groupName={group.name}
            accountNumber={group.account_number || group.bank_details?.accountNumber}
            bankName={group.bank_name || group.bank_details?.bankName || 'Sterling Bank'}
            accountName={group.account_name || group.bank_details?.accountName || group.name}
          />
        ) : (
          <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Bank Account Not Set Up</h3>
                <p className="text-sm text-muted-foreground">
                  This group doesn't have a dedicated bank account yet. 
                  {group.creator_id === user?.id ? ' Set up a virtual account to receive bank transfers.' : ' Contact the group creator to set up bank transfers.'}
                </p>
              </div>
              {group.creator_id === user?.id && (
                <Button 
                  onClick={() => setShowBvnDialog(true)}
                  disabled={isCreatingAccount}
                  className="mt-2"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {isCreatingAccount ? 'Setting up...' : 'Set Up Bank Account'}
                </Button>
              )}
            </div>
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

      {/* BVN Input Dialog */}
      <BvnInputDialog
        open={showBvnDialog}
        onOpenChange={setShowBvnDialog}
        onSubmit={handleSetupBankAccount}
        isLoading={isCreatingAccount}
      />
    </div>
  );
}
