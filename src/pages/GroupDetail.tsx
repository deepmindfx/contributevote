import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Info,
  Users,
  Archive,
  ArchiveRestore,
  Building2,
  ShieldCheck,
  Vote,
  CalendarClock,
  Globe,
  Lock,
  SlidersHorizontal,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import {
  archiveGroup,
  unarchiveGroup,
  getCategoryIcon,
  getCategoryLabel,
} from '@/services/supabase/groupEnhancementService';
import { createGroupVirtualAccount } from '@/services/flutterwave/virtualAccounts';
import { ContributeButton } from '@/components/contribution/ContributeButton';
import { RecurringContributionDialog } from '@/components/contribution/RecurringContributionDialog';
import { ScheduledContributionDialog } from '@/components/contribution/ScheduledContributionDialog';
import { GroupRefundDialog } from '@/components/contribution/GroupRefundDialog';
import { RefundRequestsCard } from '@/components/contribution/RefundRequestsCard';
import { GroupActivityTimeline } from '@/components/contribution/GroupActivityTimeline';
import { ContributorsList } from '@/components/contribution/ContributorsList';
import { GroupAdminPanel } from '@/components/contribution/GroupAdminPanel';
import { VotingRightsGuard } from '@/components/contribution/VotingRightsGuard';
import { ShareableBankCard } from '@/components/contribution/ShareableBankCard';
import { ShareGroupButton } from '@/components/contribution/ShareGroupButton';
import { InviteMembersDialog } from '@/components/contribution/InviteMembersDialog';
import { BvnInputDialog } from '@/components/contribution/BvnInputDialog';
import { useVotingRights } from '@/hooks/useVotingRights';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import BrandLoader from '@/components/ui/BrandLoader';

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
  const [userBvn, setUserBvn] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'activity'>('overview');

  const isCreator = group?.creator_id === user?.id;

  useEffect(() => {
    const fetchUserBvn = async () => {
      if (user?.id) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase
            .from('profiles')
            .select('bvn')
            .eq('id', user.id)
            .single();

          if (!error && data?.bvn) {
            setUserBvn(data.bvn);
          }
        } catch (error) {
          console.error('Error fetching user BVN:', error);
        }
      }
    };

    fetchUserBvn();
  }, [user?.id]);

  useEffect(() => {
    const fetchGroup = async () => {
      if (!id) return;

      const foundGroup = contributions.find((c: any) => c.id === id);
      if (foundGroup) {
        setGroup(foundGroup);
        return;
      }

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
    await refreshContributionData();

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
      if (!userBvn && bvn) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('profiles')
          .update({ bvn: bvn })
          .eq('id', user.id);
        setUserBvn(bvn);
      }

      const accountData = await createGroupVirtualAccount({
        email: user.email,
        bvn: bvn,
        groupName: group.name,
        groupId: group.id,
      });

      if (accountData.success && accountData.responseBody) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { error: updateError } = await supabase
          .from('contribution_groups')
          .update({
            account_number: accountData.responseBody.account_number,
            account_name: group.name,
            bank_name: accountData.responseBody.bank_name || null,
            account_reference: accountData.responseBody.order_ref || accountData.responseBody.flw_ref,
            account_details: accountData.responseBody,
          })
          .eq('id', group.id);

        if (updateError) {
          console.error('Error saving account details:', updateError);
          toast.error('Failed to save bank account details');
        } else {
          toast.success('Bank account created successfully!');
          setShowBvnDialog(false);

          setGroup((prevGroup: any) => ({
            ...prevGroup,
            account_number: accountData.responseBody.account_number,
            account_name: group.name,
            bank_name: accountData.responseBody.bank_name || null,
            account_reference: accountData.responseBody.order_ref || accountData.responseBody.flw_ref,
            account_details: accountData.responseBody,
          }));

          refreshContributionData();
        }
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
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-5xl">
          <BrandLoader
            variant="page"
            message="Loading group details"
            submessage="Syncing contributions, votes, and balances…"
          />
        </div>
      </div>
    );
  }

  if (!group && !loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-xl">
          <Card className="rounded-[1.5rem] p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Group Not Found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The group you're looking for doesn't exist or may have been removed.
            </p>
            <Button asChild className="mt-6 h-11 rounded-xl">
              <Link to="/all-groups">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Groups
              </Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const currentAmount = Number(group.current_amount || 0);
  const targetAmount = Number(group.target_amount || 0);
  const progress = targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100)) : 0;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const isActive = group.status === 'active';
  const isPublic = group.privacy === 'public';
  const hasBankAccount = Boolean(group.account_number || group.bank_details?.accountNumber);

  return (
    <div className="min-h-screen">
      {isCreatingAccount && (
        <BrandLoader
          variant="overlay"
          badge="Virtual Account"
          message="Generating bank account"
          submessage={`Issuing a dedicated account number for ${group.name}…`}
        />
      )}
      {isArchiving && (
        <BrandLoader
          variant="overlay"
          badge="Group Status"
          message={group.archived ? 'Restoring group' : 'Archiving group'}
          submessage="Updating your group workspace…"
        />
      )}

      <Header />

      <main className="app-page max-w-5xl space-y-5 md:space-y-6">
        {/* Top Native Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost" className="min-h-11 gap-2 rounded-xl px-3">
            <Link to="/all-groups">
              <ArrowLeft size={16} />
              My groups
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            {isPublic && (
              <ShareGroupButton
                groupId={group.id}
                groupName={group.name}
                groupDescription={group.description || ''}
              />
            )}

            {!isPublic && group.creator_id === user?.id && (
              <InviteMembersDialog
                groupId={group.id}
                groupName={group.name}
                userId={user.id}
                privacy={group.privacy}
              />
            )}
          </div>
        </div>

        {/* Signature Deep-Emerald Native Pool Vault Hero */}
        <section className="group-vault-hero overflow-hidden rounded-[1.6rem] p-5 shadow-[0_24px_54px_-28px_rgba(12,48,39,0.55)] sm:p-7">
          {/* Status & Meta Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                <span aria-hidden="true">{getCategoryIcon(group.category)}</span>
                {getCategoryLabel(group.category)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-[#d4ece0]">
                {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {isPublic ? 'Public' : 'Private'}
              </span>
              {group.archived && (
                <span className="inline-flex items-center rounded-full bg-amber-300/20 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  Archived
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canVote && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#dbf5b4] px-2.5 py-1 text-xs font-semibold text-[#0c3027]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Voting active
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-[#e2f5eb]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-[#dbf5b4]' : 'bg-white/40'}`}
                />
                {group.status}
              </span>
            </div>
          </div>

          {/* Group Title & Description */}
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
              {group.name}
            </h1>
            {group.description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#c6dfd3]">
                {group.description}
              </p>
            )}
          </div>

          {/* Pool Balance & Goal Progress */}
          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#a9ccb9]">
                  Total Pooled
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-4xl font-extrabold tracking-[-0.05em] text-white tabular-nums sm:text-[2.75rem]">
                    ₦{currentAmount.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-[#b9d9c8] tabular-nums">
                    of ₦{targetAmount.toLocaleString()} target
                  </span>
                </div>
              </div>

              <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-bold text-[#dbf5b4] tabular-nums">
                {progress.toFixed(0)}%
              </span>
            </div>

            {/* High-Contrast Lime-Mint Progress Rail */}
            <div
              className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-white/14"
              role="progressbar"
              aria-label="Group funding progress"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[#dbf5b4] transition-all duration-500"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>

            {/* Compact 3-Metric Strip */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:gap-4 sm:p-3.5">
              <div>
                <p className="text-[11px] font-medium text-[#a9ccb9]">Remaining</p>
                <p className="mt-0.5 text-sm font-semibold text-white tabular-nums sm:text-base">
                  {remaining === 0 ? 'Goal met' : `₦${remaining.toLocaleString()}`}
                </p>
              </div>
              <div className="border-x border-white/10 px-2 sm:px-4">
                <p className="text-[11px] font-medium text-[#a9ccb9]">Schedule</p>
                <p className="mt-0.5 text-sm font-semibold capitalize text-white sm:text-base">
                  {group.frequency || 'Flexible'}
                </p>
              </div>
              <div className="pl-1 sm:pl-2">
                <p className="text-[11px] font-medium text-[#a9ccb9]">Deadline</p>
                <p className="mt-0.5 text-sm font-semibold text-white tabular-nums sm:text-base">
                  {group.end_date
                    ? new Date(group.end_date).toLocaleDateString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Open'}
                </p>
              </div>
            </div>
          </div>

          {/* Native Action Dock */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {isActive && (
              <div className="sm:min-w-[12rem] sm:flex-1">
                <ContributeButton
                  groupId={id!}
                  groupName={group.name}
                  onSuccess={handleContributeSuccess}
                  variant="hero"
                />
              </div>
            )}

            {group.enable_voting_rights && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/votes')}
                className="h-12 rounded-xl border border-white/15 bg-white/10 px-4 font-semibold text-white hover:bg-white/18 hover:text-white"
              >
                <Vote className="mr-2 h-4 w-4 text-[#dbf5b4]" />
                Group Votes
              </Button>
            )}

            {isActive && canVote && (
              <div className="flex flex-wrap gap-2">
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
              </div>
            )}
          </div>
        </section>

        {/* Governance Notice when Voting is Disabled */}
        {!group.enable_voting_rights && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3.5 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <Info size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              <strong>Admin-managed withdrawals:</strong> Member voting is turned off for this group. The group admin can approve withdrawals directly.
            </p>
          </div>
        )}

        {/* Refund Requests Banner (surfaced above tabs whenever active) */}
        <RefundRequestsCard groupId={id!} />

        {/* Native Segmented Workspace Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'overview' | 'members' | 'activity')}
          className="space-y-5"
        >
          <TabsList className="app-segmented grid w-full grid-cols-3" aria-label="Group sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-7">
                {hasBankAccount ? (
                  <ShareableBankCard
                    groupName={group.name}
                    accountNumber={group.account_number || group.bank_details?.accountNumber}
                    bankName={
                      group.bank_name ||
                      group.account_details?.bank_name ||
                      group.bank_details?.bankName ||
                      'Virtual Bank'
                    }
                    accountName={group.account_name || group.bank_details?.accountName || group.name}
                  />
                ) : (
                  <Card className="rounded-[1.35rem] border-dashed p-6 shadow-sm">
                    <div className="flex flex-col items-center text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                        <Building2 className="h-6 w-6" />
                      </span>
                      <h3 className="mt-3 text-base font-semibold">Dedicated Bank Account</h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {isCreator
                          ? 'Issue a dedicated virtual account so members can transfer directly from any Nigerian bank app.'
                          : 'The group creator has not enabled a dedicated bank account yet.'}
                      </p>
                      {isCreator && (
                        <Button
                          onClick={() => setShowBvnDialog(true)}
                          disabled={isCreatingAccount}
                          className="mt-4 h-11 rounded-xl"
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          Set up bank account
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-5 lg:col-span-5">
                {/* Governance & Voting Card */}
                <VotingRightsGuard
                  groupId={id!}
                  groupName={group.name}
                  onContributeSuccess={handleContributeSuccess}
                >
                  <Card className="rounded-[1.35rem] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                          <Vote className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-base font-bold tracking-tight">Democratic Governance</h2>
                          <p className="text-xs text-muted-foreground">
                            {group.voting_threshold || 60}% member approval required
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                        Active
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Your contributions give you a direct vote on withdrawals and group refund proposals.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/votes')}
                      className="mt-4 h-11 w-full justify-between rounded-xl font-semibold"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Open active votes
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Card>
                </VotingRightsGuard>

                {/* Creator Management Card */}
                {isCreator && (
                  <Card className="rounded-[1.35rem] p-5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground">
                        <SlidersHorizontal className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold">Creator Controls</h3>
                        <p className="text-xs text-muted-foreground">Refunds & archive status</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2.5">
                      {isActive && (
                        <GroupRefundDialog
                          groupId={id!}
                          groupName={group.name}
                          onSuccess={handleContributeSuccess}
                        />
                      )}
                      <Button
                        variant="outline"
                        onClick={group.archived ? handleUnarchive : handleArchive}
                        disabled={isArchiving}
                        className="h-11 w-full justify-start rounded-xl"
                      >
                        {group.archived ? (
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                        ) : (
                          <Archive className="mr-2 h-4 w-4" />
                        )}
                        {group.archived ? 'Restore group' : 'Archive group'}
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Quick Summary Card for Contribution Plan */}
                {group.contribution_amount > 0 && (
                  <Card className="rounded-[1.35rem] p-5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                        <CalendarClock className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs text-muted-foreground">Suggested contribution</p>
                        <p className="text-base font-bold tabular-nums">
                          ₦{Number(group.contribution_amount).toLocaleString()}
                          <span className="ml-1 text-xs font-normal capitalize text-muted-foreground">
                            / {group.frequency || 'cycle'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {isAdmin && <GroupAdminPanel groupId={id!} isAdmin={isAdmin} />}
          </TabsContent>

          {/* MEMBERS TAB */}
          <TabsContent value="members">
            <ContributorsList groupId={id!} />
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity">
            <GroupActivityTimeline groupId={id!} />
          </TabsContent>
        </Tabs>
      </main>

      <BvnInputDialog
        open={showBvnDialog}
        onOpenChange={setShowBvnDialog}
        onSubmit={handleSetupBankAccount}
        isLoading={isCreatingAccount}
        initialBvn={userBvn}
      />
    </div>
  );
}
