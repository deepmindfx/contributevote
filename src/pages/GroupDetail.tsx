import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupTransferAnalytics } from '@/components/wallet/MonthlyFlowInsights';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Users,
  Archive,
  ArchiveRestore,
  Building2,
  Camera,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseUser } from '@/contexts/SupabaseUserContext';
import { useSupabaseContribution } from '@/contexts/SupabaseContributionContext';
import {
  archiveGroup,
  unarchiveGroup,
  getCategoryLabel,
} from '@/services/supabase/groupEnhancementService';
import {
  formatByteSize,
  updateGroupCoverImage,
  uploadGroupCoverImageWithMeta,
} from '@/services/supabase/groupImageService';
import { createGroupVirtualAccount, groupBankSupportLink } from '@/services/flutterwave/virtualAccounts';
import { ContributeButton } from '@/components/contribution/ContributeButton';
import { RecurringContributionDialog } from '@/components/contribution/RecurringContributionDialog';
import { ScheduledContributionDialog } from '@/components/contribution/ScheduledContributionDialog';
import { GroupRefundDialog } from '@/components/contribution/GroupRefundDialog';
import { RefundRequestsCard } from '@/components/contribution/RefundRequestsCard';
import { GroupWithdrawalVotesCard } from '@/components/contribution/GroupWithdrawalVotesCard';
import { GroupActivityTimeline } from '@/components/contribution/GroupActivityTimeline';
import { ContributorsList } from '@/components/contribution/ContributorsList';
import { GroupAdminPanel } from '@/components/contribution/GroupAdminPanel';
import { PendingBankTransfers } from '@/components/contribution/PendingBankTransfers';
import { ShareableBankCard } from '@/components/contribution/ShareableBankCard';
import { ShareGroupButton } from '@/components/contribution/ShareGroupButton';
import { GroupCover } from '@/components/contribution/GroupCover';
import { GroupJoinService } from '@/services/supabase/groupJoinService';
import { InviteMembersDialog } from '@/components/contribution/InviteMembersDialog';
import { BvnInputDialog } from '@/components/contribution/BvnInputDialog';
import { GroupRules } from '@/components/contribution/GroupRules';
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from '@/components/contribution/VerifiedCrowdfunderBadge';
import { useVotingRights } from '@/hooks/useVotingRights';
import Header from '@/components/layout/Header';
import BrandLoader from '@/components/ui/BrandLoader';
import { Skeleton } from '@/components/ui/skeleton';

type GroupRow = Database['public']['Tables']['contribution_groups']['Row'];

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin: isPlatformAdmin, refreshCurrentUser } = useSupabaseUser();
  const { contributions, refreshContributionData } = useSupabaseContribution();
  const queryClient = useQueryClient();
  const groupFromWorkspace = contributions.find((candidate) => candidate.id === id);
  const userId = user?.id;
  const isWorkspaceGroup = Boolean(groupFromWorkspace);
  const detail = useQuery({
    queryKey: ["workspace", userId, "group", id],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("contribution_groups")
        .select("*, contributors(user_id, has_voting_rights)").eq("id", id!).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId && id && !isWorkspaceGroup),
    staleTime: 20_000,
    retry: false,
  });
  useEffect(() => {
    if (!userId || !id || isWorkspaceGroup) return;
    const channel = supabase.channel(`group-detail-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contribution_groups", filter: `id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["workspace", userId, "group", id] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, userId, isWorkspaceGroup, queryClient]);
  const group: any = groupFromWorkspace ?? detail.data;
  const { hasVotingRights, canVote, loading: rightsLoading, refresh: refreshVotingRights } = useVotingRights(group?.id, group?.creator_id);
  const updateCachedGroup = (changes: Partial<GroupRow>) => {
    queryClient.setQueryData<GroupRow[]>(["workspace", userId, "groups"], (rows) =>
      rows?.map((row) => row.id === id ? { ...row, ...changes } : row),
    );
    queryClient.setQueryData<GroupRow | null>(["workspace", userId, "group", id], (row) =>
      row ? { ...row, ...changes } : row,
    );
  };
  const [isArchiving, setIsArchiving] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showBvnDialog, setShowBvnDialog] = useState(false);
  const [bankSetupFeedback, setBankSetupFeedback] = useState<{ groupId: string; message: string; needsReview?: boolean }>();
  const userBvn = user?.bvn ?? null;
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id || !group?.id) return;

    setIsUploadingCover(true);
    try {
      const { publicUrl, originalBytes, compressedBytes } = await uploadGroupCoverImageWithMeta(user.id, file);
      await updateGroupCoverImage(group.id, publicUrl);
      updateCachedGroup({ cover_image_url: publicUrl });
      if (originalBytes > compressedBytes) {
        toast.success(
          `Group cover photo updated (${formatByteSize(originalBytes)} → ${formatByteSize(compressedBytes)} HD)!`
        );
      } else {
        toast.success('Group cover photo updated!');
      }
      await refreshContributionData(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update cover photo');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const isCreator = group?.creator_id === user?.id;

  const handleContributeSuccess = async () => {
    await Promise.all([refreshContributionData(true), refreshVotingRights()]);
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this group? It will be hidden from the main list.')) return;

    setIsArchiving(true);
    try {
      await archiveGroup(group.id, user.id);
      toast.success('Group archived successfully');
      await refreshContributionData(true);
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
    setBankSetupFeedback(undefined);
    try {
      const cleanBvn = bvn.replace(/\D/g, "");
      if (cleanBvn.length !== 11) {
        toast.error("Please enter a valid 11-digit BVN");
        return;
      }

      if (!/^\d{11}$/.test(userBvn || "")) {
        const { data: bvnRes, error: bvnErr } = await (supabase as any).rpc('save_user_bvn', {
          p_bvn: cleanBvn,
        });
        if (bvnErr || !bvnRes?.success) {
          toast.error(bvnRes?.error || bvnErr?.message || 'BVN verification failed');
          return;
        }
        void refreshCurrentUser();
      }

      const accountData = await createGroupVirtualAccount(group.id);

      if (accountData.success && accountData.responseBody) {
        toast.success('Bank account created successfully.');
        setShowBvnDialog(false);
        updateCachedGroup({
          account_number: accountData.responseBody.account_number,
          account_name: group.name,
          bank_name: accountData.responseBody.bank_name || null,
          account_reference: accountData.responseBody.order_ref || accountData.responseBody.flw_ref,
          account_details: accountData.responseBody,
        });
        await refreshContributionData(true);
      } else {
        setBankSetupFeedback({ groupId: group.id, message: accountData.message || 'Failed to create bank account', needsReview: accountData.needsReview });
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
      updateCachedGroup({ archived: false });
      await refreshContributionData(true);
    } catch (error) {
      console.error('Error unarchiving group:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unarchive group');
    } finally {
      setIsArchiving(false);
    }
  };

  if (!group && detail.isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-5xl">
          <div className="space-y-4" role="status" aria-label="Loading group details">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="app-page max-w-xl">
          <Card className="rounded-[1.5rem] p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">{detail.isError ? 'Couldn’t load group' : 'Group not found'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {detail.isError ? 'Try again to load the group.' : 'The group may have been removed.'}
            </p>
            {detail.isError && <Button className="mt-6 h-11 rounded-xl" onClick={() => void detail.refetch()}>Retry</Button>}
            <Button asChild variant={detail.isError ? 'outline' : 'default'} className="mt-6 h-11 rounded-xl">
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
  const isActive = group.status === 'active' && !group.archived;
  const isPublic = group.privacy === 'public';
  const accountNumber = [group.account_number, group.bank_details?.accountNumber]
    .find((value): value is string => typeof value === 'string' && /^\d{10}$/.test(value));
  const bankName = group.bank_name || group.account_details?.bank_name || group.account_details?.bankName || group.bank_details?.bankName;
  const accountName = group.account_name || group.account_details?.accountName || group.bank_details?.accountName || group.name;
  const canManage = isCreator || isPlatformAdmin;

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
      {isUploadingCover && (
        <BrandLoader
          variant="overlay"
          badge="Cover Photo"
          message="Updating cover photo"
          submessage="Optimizing and publishing your group picture…"
        />
      )}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleCoverPhotoChange}
      />

      <Header mobilePanel />

      <main className="app-page app-panel-page desktop-panel-split max-w-4xl">
        <section
          className="app-panel-hero group-detail-hero relative overflow-hidden"
          aria-labelledby="group-title"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 sm:mb-4">
            <Button asChild variant="ghost" className="group-detail-back gap-1.5 px-0">
              <Link to="/all-groups"><ArrowLeft size={16} aria-hidden="true" /> My groups</Link>
            </Button>
            <div className="app-panel-tools flex flex-wrap gap-2">
              {isPublic && isActive && (
                <ShareGroupButton
                  groupId={group.id}
                  shareSlug={group.share_slug}
                  groupName={group.name}
                  groupDescription={group.description || ""}
                  category={group.category}
                  targetAmount={targetAmount}
                  currentAmount={currentAmount}
                  coverUrl={group.cover_image_url}
                  accountNumber={accountNumber}
                  bankName={bankName}
                  accountName={accountName}
                />
              )}
              {!isPublic && isCreator && isActive && <InviteMembersDialog key={group.id} groupId={group.id} groupName={group.name} />}
            </div>
          </div>
          <GroupCover url={group.cover_image_url} name={group.name} category={group.category}
            className="mb-4 mt-1 max-h-72 rounded-2xl border border-white/15 lg:max-h-56">
            {isCreator && (
              <Button type="button" size="sm" variant="secondary" disabled={isUploadingCover}
                onClick={() => coverInputRef.current?.click()}
                className="h-9 gap-1.5 rounded-full border border-white/20 bg-[#082b24]/90 px-3 text-xs font-semibold text-white backdrop-blur-sm hover:bg-[#082b24]">
                <Camera size={14} aria-hidden="true" /> {group.cover_image_url ? "Change photo" : "Add photo"}
              </Button>
            )}
          </GroupCover>
          <p className="panel-kicker text-sm">
            {isPublic ? "Public" : "Private"} · {getCategoryLabel(group.category)}
            {!isActive && ` · ${group.archived ? "Archived" : group.status}`}
          </p>
          <h1 id="group-title" className="app-page-title mt-1">{group.name}</h1>
          {(group.is_verified || group.is_pinned || group.spotlight_label) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {(group.is_pinned || group.spotlight_label) && (
                <SpotlightBadge
                  label={group.spotlight_label}
                  isPinned={Boolean(group.is_pinned)}
                  onDark
                  size="md"
                />
              )}
              {group.is_verified && <VerifiedCrowdfunderBadge onDark size="md" />}
            </div>
          )}

          <div className="mt-3 sm:mt-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="break-words text-[clamp(1.65rem,6.8vw,2.9rem)] font-semibold leading-tight tracking-[-.045em] tabular-nums">₦{currentAmount.toLocaleString()}</p>
              <p className="panel-kicker text-sm tabular-nums">raised of ₦{targetAmount.toLocaleString()}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Group funding progress" aria-valuenow={Math.round(progress)}>
              <div className="h-full rounded-full bg-[#dcf6b8]" style={{ width: progress + "%" }} />
            </div>
          </div>
        </section>

        <div className="app-panel-body space-y-4">
          {(isActive || accountNumber || isCreator) && (
            <div className="group-detail-actions">
              {isActive && <ContributeButton groupId={group.id} groupName={group.name} rules={group} onSuccess={handleContributeSuccess} className="h-11 w-full sm:w-auto" />}
              {accountNumber ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-11 gap-2 rounded-xl">
                      <Building2 size={16} aria-hidden="true" /> Bank details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="gap-4">
                    <div className="space-y-1 pr-9">
                      <DialogTitle>Bank details</DialogTitle>
                      <DialogDescription>
                        {isActive ? "Transfer directly to this group from your bank." : "This group is currently closed to contributions."}
                        {isActive && group.enable_voting_rights !== false && " A group admin can link your transfer to your registered account to grant voting rights."}
                      </DialogDescription>
                    </div>
                    <ShareableBankCard
                      groupName={group.name}
                      accountNumber={accountNumber}
                      bankName={bankName || "Bank name unavailable"}
                      accountName={accountName}
                      category={group.category}
                      coverUrl={group.cover_image_url}
                      joinLink={isPublic && isActive ? GroupJoinService.generateShareLink(group.id, group.share_slug) : undefined}
                      active={isActive && Boolean(bankName)}
                    />
                    {isActive && (
                      <details className="rounded-xl border px-3 py-2.5">
                        <summary className="cursor-pointer text-sm font-medium">Group rules and voting rights</summary>
                        <div className="pt-3"><GroupRules group={group} showTitle={false} /></div>
                      </details>
                    )}
                  </DialogContent>
                </Dialog>
              ) : isCreator && (
                <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={() => setShowBvnDialog(true)} disabled={isCreatingAccount}>
                  <Building2 size={16} aria-hidden="true" /> Bank setup
                </Button>
              )}
            </div>
          )}

          {group.enable_voting_rights !== false && (
            <GroupWithdrawalVotesCard
              groupId={group.id}
              votingThreshold={group.voting_threshold}
              hasVotingRights={hasVotingRights}
              onVoteComplete={handleContributeSuccess}
            />
          )}

          <RefundRequestsCard
            groupId={group.id}
            votingThreshold={group.voting_threshold}
            hasVotingRights={hasVotingRights}
            canRetryRefund={isCreator}
          />

          <Tabs key={group.id} defaultValue="overview">
            <TabsList className="app-segmented group-detail-tabs flex w-full justify-start overflow-x-auto" aria-label="Group sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {isCreator && <TabsTrigger value="insights">Insights</TabsTrigger>}
              {canManage && <TabsTrigger value="manage">Manage</TabsTrigger>}
            </TabsList>

            {isCreator && (
              <TabsContent value="insights" className="mt-4">
                <GroupTransferAnalytics groupId={group.id} />
              </TabsContent>
            )}
            <TabsContent value="overview" className="mt-3">
              <Card className="rounded-2xl px-4 sm:px-5">
                <details>
                  <summary className="app-disclosure">
                    <span className="font-semibold">Group rules</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <div className="space-y-3 pb-4">
                    <GroupRules group={group} showTitle={false} />
                    {group.enable_voting_rights !== false && (
                      <p className="text-sm text-muted-foreground">
                        {rightsLoading ? "Checking voting rights…" : hasVotingRights ? "Your voting rights are active." : "Contribute to become eligible to vote."}
                      </p>
                    )}
                  </div>
                </details>
                {group.enable_voting_rights !== false && (
                  <Link className="group-detail-link" to="/votes">
                    <span className="font-semibold">View all votes</span>
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
              {isPublic && isCreator && isActive && (
                <div className="mb-3 flex justify-end"><InviteMembersDialog key={group.id} groupId={group.id} groupName={group.name} /></div>
              )}
              <ContributorsList groupId={group.id} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <GroupActivityTimeline groupId={group.id} />
            </TabsContent>

            {canManage && (
              <TabsContent value="manage" className="mt-4 space-y-4">
                {isCreator && <GroupAdminPanel groupId={group.id} isAdmin />}
                {!isCreator && isPlatformAdmin && <PendingBankTransfers groupId={group.id} isAdmin />}
                {isCreator && (
                  <Card className="space-y-3 rounded-2xl p-4">
                    <h2 className="app-section-title">Group settings</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={isUploadingCover}
                        className="h-11 justify-start gap-2 rounded-xl"
                      >
                        <Camera size={16} aria-hidden="true" />
                        {group.cover_image_url ? "Change cover photo" : "Add cover photo"}
                      </Button>
                      {isActive && <GroupRefundDialog groupId={group.id} groupName={group.name} votingThreshold={group.voting_threshold} onSuccess={handleContributeSuccess} />}
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
        feedback={bankSetupFeedback?.groupId === group.id && (
          <div role="status" className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
            <p>{bankSetupFeedback.message}</p>
            {bankSetupFeedback.needsReview && <a className="font-medium text-primary underline" href={groupBankSupportLink(group.id)}>Contact support about this bank request</a>}
          </div>
        )}
        initialBvn={userBvn}
      />
    </div>
  );
}
