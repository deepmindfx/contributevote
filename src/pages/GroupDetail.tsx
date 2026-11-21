import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Users,
  Archive,
  ArchiveRestore,
  Building2,
  Globe,
  Lock,
  ChevronDown,
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
import { ShareableBankCard } from '@/components/contribution/ShareableBankCard';
import { ShareGroupButton } from '@/components/contribution/ShareGroupButton';
import { InviteMembersDialog } from '@/components/contribution/InviteMembersDialog';
import { BvnInputDialog } from '@/components/contribution/BvnInputDialog';
import { useVotingRights } from '@/hooks/useVotingRights';
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
      if (!/^\d{11}$/.test(userBvn || "")) {
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
  const isActive = group.status === 'active';
  const isPublic = group.privacy === 'public';
  const accountNumber = group.account_number || group.bank_details?.accountNumber;
  const canManage = isCreator || isAdmin;

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

      <Header mobilePanel />

      <main className="app-page app-panel-page max-w-5xl">
        <section className="app-panel-hero" aria-labelledby="group-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button asChild variant="ghost" className="app-panel-secondary gap-2">
              <Link to="/all-groups"><ArrowLeft size={16} aria-hidden="true" /> My groups</Link>
            </Button>
            <div className="app-panel-tools flex flex-wrap gap-2">
              {isPublic && <ShareGroupButton groupId={group.id} groupName={group.name} groupDescription={group.description || ""} />}
              {!isPublic && isCreator && <InviteMembersDialog groupId={group.id} groupName={group.name} userId={user.id} privacy={group.privacy} />}
            </div>
          </div>
          <div className="panel-kicker flex flex-wrap items-center gap-2 text-sm">
            <span>{getCategoryIcon(group.category)} {getCategoryLabel(group.category)}</span>
            <span aria-hidden="true">·</span>
            <span className="panel-kicker inline-flex items-center gap-1.5">
              {isPublic ? <Globe size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
              {isPublic ? "Public" : "Private"}
            </span>
            {(group.archived || !isActive) && <span className="rounded-full bg-white/15 px-3 py-1 capitalize">{group.archived ? "Archived" : group.status}</span>}
          </div>
          <h1 id="group-title" className="app-page-title mt-2">{group.name}</h1>

          <div className="mt-5">
            <p className="panel-kicker text-sm font-medium">Total raised</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="break-words text-[clamp(2rem,7.5vw,3.1rem)] font-semibold leading-tight tracking-[-.055em] tabular-nums">₦{currentAmount.toLocaleString()}</p>
              <p className="panel-kicker text-sm tabular-nums">of ₦{targetAmount.toLocaleString()} goal</p>
            </div>
            <div className="mb-2 mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Group funding progress" aria-valuenow={Math.round(progress)}>
              <div className="h-full rounded-full bg-[#dcf6b8]" style={{ width: progress + "%" }} />
            </div>
            <p className="panel-kicker text-sm tabular-nums">{progress >= 100 ? "Goal reached" : `${progress.toFixed(0)}% funded`}</p>
          </div>
        </section>

        <div className="app-panel-body space-y-4">
          {(isActive || accountNumber || isCreator) && (
            <div className="group-detail-actions">
              {isActive && <ContributeButton groupId={group.id} groupName={group.name} onSuccess={handleContributeSuccess} className="h-12 w-full sm:w-auto" />}
              {accountNumber ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-12 gap-2 rounded-xl">
                      <Building2 size={16} aria-hidden="true" /> Bank details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="p-2 pt-14 sm:p-3 sm:pt-14">
                    <DialogTitle className="sr-only">Group bank details</DialogTitle>
                    <DialogDescription className="sr-only">Copy or share the account details for this group.</DialogDescription>
                    <ShareableBankCard
                      groupName={group.name}
                      accountNumber={accountNumber}
                      bankName={group.bank_name || group.account_details?.bank_name || group.bank_details?.bankName || "Virtual Bank"}
                      accountName={group.account_name || group.bank_details?.accountName || group.name}
                    />
                  </DialogContent>
                </Dialog>
              ) : isCreator && (
                <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={() => setShowBvnDialog(true)} disabled={isCreatingAccount}>
                  <Building2 size={16} aria-hidden="true" /> Bank setup
                </Button>
              )}
            </div>
          )}

          <RefundRequestsCard groupId={group.id} />

          <Tabs key={group.id} defaultValue="overview">
            <TabsList className="app-segmented group-detail-tabs grid w-full grid-flow-col auto-cols-fr" aria-label="Group sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {canManage && <TabsTrigger value="manage">Manage</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card className="rounded-2xl px-4 sm:px-5">
                <div className="py-4">
                  <h2 className="app-section-title">Group details</h2>
                  {group.description && <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{group.description}</p>}
                </div>
                <dl className="group-detail-summary divide-y text-sm">
                  {Number(group.contribution_amount) > 0 && (
                    <div>
                      <dt>Amount per member</dt>
                      <dd>₦{Number(group.contribution_amount).toLocaleString()}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Schedule</dt>
                    <dd className="capitalize">{group.frequency || "Flexible"}</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{group.end_date ? new Date(group.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "No deadline"}</dd>
                  </div>
                  <div>
                    <dt>Withdrawal approval</dt>
                    <dd>{group.enable_voting_rights ? "Member vote" : "Group admin"}</dd>
                  </div>
                </dl>
                {group.enable_voting_rights && (
                  <Link className="group-detail-link" to="/votes">
                    <span>
                      <span className="block font-semibold">View votes</span>
                      <span className="block text-xs text-muted-foreground">
                        {canVote ? (group.voting_threshold || 60) + "% approval required" : "Contribute to become eligible to vote"}
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {isActive && canVote && (
                  <details className="border-t">
                    <summary className="app-disclosure">
                      <span className="font-semibold">Plan a contribution</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="grid gap-2 pb-3 sm:grid-cols-2">
                      <RecurringContributionDialog groupId={group.id} groupName={group.name} onSuccess={handleContributeSuccess} />
                      <ScheduledContributionDialog groupId={group.id} groupName={group.name} onSuccess={handleContributeSuccess} />
                    </div>
                  </details>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <ContributorsList groupId={group.id} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <GroupActivityTimeline groupId={group.id} />
            </TabsContent>

            {canManage && (
              <TabsContent value="manage" className="mt-4 space-y-4">
                {isAdmin && <GroupAdminPanel groupId={group.id} isAdmin={isAdmin} />}
                {isCreator && (
                  <Card className="space-y-3 rounded-2xl p-4">
                    <h2 className="app-section-title">Group settings</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {isActive && <GroupRefundDialog groupId={group.id} groupName={group.name} onSuccess={handleContributeSuccess} />}
                      <Button variant="outline" onClick={group.archived ? handleUnarchive : handleArchive} disabled={isArchiving} className="h-11 justify-start gap-2 rounded-xl">
                        {group.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                        {group.archived ? "Restore group" : "Archive group"}
                      </Button>
                    </div>
                  </Card>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
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
