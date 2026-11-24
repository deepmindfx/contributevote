import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ExternalLink,
  Flag,
  Flame,
  Gavel,
  Globe,
  Lock,
  Pin,
  Play,
  ReceiptText,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import BrandLoader from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CollectiPayReceipt, { type CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { TransactionService } from "@/services/supabase/transactionService";
import {
  AdminComplianceService,
  type AdminAuditLogRecord,
  type AdminPenaltyRecord,
  type AmlAlertRecord,
  type AmlAlertSeverity,
  type AmlAlertStatus,
  type ExternalPaymentTrackRecord,
  type PenaltyType,
} from "@/services/supabase/adminComplianceService";
import {
  AmlReviewDialog,
  GroupControlDialog,
  GroupSpotlightDialog,
  IssuePenaltyDialog,
  ManualAmlFlagDialog,
  VerifyOrganizerDialog,
  WalletAdjustDialog,
} from "@/components/admin/AdminActionDialogs";
import { AdminPaymentSettings } from "@/components/admin/AdminPaymentSettings";
import { AdminPayoutHealth } from "@/components/admin/AdminPayoutHealth";
import { AdminPaymentReviews } from "@/components/admin/AdminPaymentReviews";
import { AdminPaymentAlertSounds } from "@/components/admin/AdminPaymentAlertSounds";
import { AdminPricingRevenue } from "@/components/admin/AdminPricingRevenue";
import { AdminBulkTransfers } from "@/components/admin/AdminBulkTransfers";
import { AdminTransactionAnalytics } from "@/components/admin/AdminTransactionAnalytics";
import { AdminWalletBankBonus } from "@/components/admin/AdminWalletBankBonus";
import { AdminWalletAdjustments } from "@/components/admin/AdminWalletAdjustments";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AdminIceVault } from "@/components/admin/AdminIceVault";
import { AdminGroupGovernance } from "@/components/admin/AdminGroupGovernance";
import { AdminOperationsOverview } from "@/components/admin/AdminOperationsOverview";
import { AdminShell, resolveAdminSection, type AdminSection } from "@/components/admin/AdminShell";
import { SupportInbox } from "@/components/support/SupportInbox";
import { AdminPageControls, useAdminRecordPage, useAdminSearch } from "@/components/admin/AdminRecordPage";
import { AdminUserTransactionHistory } from "@/components/admin/AdminUserTransactionHistory";
import { adminTransactionReceipt, type AdminTransaction } from "@/lib/adminTransactionReceipt";
import type { AdminEntity } from "@/components/admin/AdminEntityPicker";
import type { Database } from "@/integrations/supabase/types";
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from "@/components/contribution/VerifiedCrowdfunderBadge";
import { cn } from "@/lib/utils";
import { isAdminQueryKey } from "@/lib/adminQueries";

type Tables = Database["public"]["Tables"];
type AdminUser = Pick<Tables["profiles"]["Row"], "id" | "name" | "email" | "phone" | "status" | "role" | "wallet_balance" | "is_verified_organizer" | "organizer_badge_label"> &
  { has_pin: boolean; has_bvn: boolean; profile_image: string | null };
type AdminGroup = Pick<Tables["contribution_groups"]["Row"], "id" | "name" | "category" | "frequency" | "status" | "archived" | "is_verified" | "is_pinned" | "spotlight_label" | "featured_priority" | "verification_note" | "current_amount" | "target_amount" | "voting_threshold" | "enable_voting_rights" | "privacy"> &
  { profiles: { name: string | null; email: string | null }; member_count: number };

const HIGH_VALUE_THRESHOLD = 500000;

const noticeStatuses = { all: "All", pending: "Open", waived: "Closed", applied: "Historical debit" } as const;

function accountEntity(profile: { id: string; name?: string | null; email?: string | null }): AdminEntity {
  return { id: profile.id, name: profile.name || profile.email || "Account " + profile.id, description: profile.email ?? null };
}

function AdminView({ active, value, className, children }: {
  active: AdminSection;
  value: AdminSection;
  className?: string;
  children: React.ReactNode;
}) {
  return active === value ? <div className={className}>{children}</div> : null;
}

const safeFormatDate = (dateStr?: string | null, fmt = "MMM d, yyyy · h:mm a") => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : "N/A";
};

const formatNaira = (amount?: number | null) =>
  `₦${Number(amount || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const severityBadgeStyle = (severity: AmlAlertSeverity) => {
  switch (severity) {
    case "critical":
      return "border-red-500/35 bg-red-500/15 text-red-700 dark:text-red-300";
    case "high":
      return "border-orange-500/35 bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "medium":
      return "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300";
  }
};

const amlStatusBadgeStyle = (status: AmlAlertStatus) => {
  switch (status) {
    case "open":
      return "bg-red-500/12 text-red-700 dark:text-red-300";
    case "escalated":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300";
    case "investigating":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "resolved":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const AdminDashboard = () => {
  const { user, logout } = useSupabaseUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = resolveAdminSection(searchParams.get("tab"));
  const sectionHref = (section: AdminSection) => {
    const params = new URLSearchParams(searchParams);
    if (section === "operations") params.delete("tab");
    else params.set("tab", section);
    const search = params.toString();
    return search ? "/admin?" + search : "/admin";
  };

  // Platform datasets
  const [supportTicket, setSupportTicket] = useState<string | null>(null);
  const [extFilter, setExtFilter] = useState<"all" | "unverified" | "flagged" | "blocked" | "verified">("all");
  const [extQuery, setExtQuery] = useState("");

  // Busy overlay state for kinetic Pooling-C feedback
  const [overlayState, setOverlayState] = useState<{
    message: string;
    submessage: string;
  } | null>(null);

  // Filters
  const [userQuery, setUserQuery] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "paused" | "frozen" | "no_bvn">("all");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "active" | "verified" | "pinned" | "restricted" | "archived">("all");
  const [amlStatusFilter, setAmlStatusFilter] = useState<"active" | "all" | AmlAlertStatus>("active");
  const [amlSeverityFilter, setAmlSeverityFilter] = useState<"all" | AmlAlertSeverity>("all");
  const [penaltyFilter, setPenaltyFilter] = useState<"all" | "applied" | "pending" | "waived">("all");
  const [noticeQuery, setNoticeQuery] = useState("");
  const [txQuery, setTxQuery] = useState("");
  const [findingReference, setFindingReference] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [highValueOnly, setHighValueOnly] = useState(false);
  const [auditQuery, setAuditQuery] = useState("");

  // Dialog states
  const [walletDialogUser, setWalletDialogUser] = useState<any | null>(null);
  const [penaltyDialogState, setPenaltyDialogState] = useState<{
    open: boolean;
    user: AdminEntity | null;
    amlAlertId?: string | null;
  }>({ open: false, user: null, amlAlertId: null });
  const [groupControlTarget, setGroupControlTarget] = useState<any | null>(null);
  const [spotlightGroupTarget, setSpotlightGroupTarget] = useState<any | null>(null);
  const [verifyOrganizerTarget, setVerifyOrganizerTarget] = useState<any | null>(null);
  const [reviewingAlert, setReviewingAlert] = useState<AmlAlertRecord | null>(null);
  const [manualFlagState, setManualFlagState] = useState<{ open: boolean; user: AdminEntity | null }>({
    open: false,
    user: null,
  });
  const [receiptData, setReceiptData] = useState<CollectiPayReceiptData | null>(null);
  const [historyAccount, setHistoryAccount] = useState<AdminEntity | null>(null);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const adminId = user?.id;
  const refreshing = useIsFetching({
    predicate: ({ queryKey }) => queryKey[1] === adminId && queryKey[0] !== "admin-access" && isAdminQueryKey(queryKey),
  }) > 0;
  const userSearch = useAdminSearch(userQuery);
  const groupSearch = useAdminSearch(groupQuery);
  const ledgerSearch = useAdminSearch(txQuery);
  const externalSearch = useAdminSearch(extQuery);
  const auditSearch = useAdminSearch(auditQuery);
  const noticeSearch = useAdminSearch(noticeQuery);

  const users = useAdminRecordPage<AdminUser>(adminId, "users", { enabled: activeTab === "users", status: userStatusFilter, search: userSearch });
  const groups = useAdminRecordPage<AdminGroup>(adminId, "groups", { enabled: activeTab === "groups", status: groupFilter, search: groupSearch });
  const transactions = useAdminRecordPage<AdminTransaction>(adminId, "ledger", {
    enabled: activeTab === "ledger", status: txTypeFilter, filter: highValueOnly ? "high" : "all", search: ledgerSearch,
  });
  const alerts = useAdminRecordPage<AmlAlertRecord>(adminId, "aml", { enabled: activeTab === "aml", status: amlStatusFilter, filter: amlSeverityFilter });
  const notices = useAdminRecordPage<AdminPenaltyRecord>(adminId, "penalties", { enabled: activeTab === "penalties", status: penaltyFilter, search: noticeSearch });
  const outsidePayments = useAdminRecordPage<ExternalPaymentTrackRecord>(adminId, "external", {
    enabled: activeTab === "external", status: extFilter, search: externalSearch,
  });
  const audits = useAdminRecordPage<AdminAuditLogRecord>(adminId, "audit", { enabled: activeTab === "audit", search: auditSearch });

  const loadPlatformData = useCallback(async () => {
    await queryClient.invalidateQueries({
      predicate: ({ queryKey }) => queryKey[1] === adminId && queryKey[0] !== "admin-access" && isAdminQueryKey(queryKey),
      refetchType: "active",
    });
  }, [adminId, queryClient]);

  // A burst of signups only needs one fresh aggregate, even with the board open.
  useEffect(() => {
    if (activeTab !== "operations" || !adminId) return;
    let timer: number | undefined;
    const channel = supabase.channel("admin-live-user-counter")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        if (timer !== undefined) return;
        timer = window.setTimeout(() => {
          timer = undefined;
          void queryClient.invalidateQueries({ queryKey: ["admin-operations-overview", adminId] });
        }, 900);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [activeTab, adminId, queryClient]);

  const openNoticeForAlert = (alert: AmlAlertRecord) => {
    if (!alert.user_id) return;
    setPenaltyDialogState({
      open: true,
      user: accountEntity({ id: alert.user_id, name: alert.user_profile?.name, email: alert.user_profile?.email }),
      amlAlertId: alert.id,
    });
  };

  const handleReviewExternalPayment = async (
    trackId: string,
    status: "verified" | "flagged" | "blocked"
  ) => {
    setActionPending(true);
    setOverlayState({
      message: `Marking outside payment as ${status}`,
      submessage: status === "verified" ? "Clearing external deposit in compliance ledger…" : "Updating risk status and raising AML case…",
    });
    try {
      const res = await AdminComplianceService.reviewExternalPayment(
        trackId,
        status,
        `Reviewed in Super Admin Outside Payments tracker`
      );
      if (!res?.success) {
        toast.error(res?.error || "Failed to update external payment");
        return;
      }
      toast.success(`Outside payment marked ${status}`);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to review external payment");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  // Action Handlers
  const handleRunAmlScan = async () => {
    setOverlayState({
      message: "Running AML compliance scan",
      submessage: "Scanning transactions for structuring, velocity bursts, high-value thresholds, and layering…",
    });
    try {
      const result = await AdminComplianceService.runAmlScan();
      if (!result?.success) {
        toast.error(result?.error || "AML scan failed");
        return;
      }
      toast.success(
        result.new_alerts
          ? `AML scan flagged ${result.new_alerts} new alert(s) · ${result.active_alerts} active`
          : `AML scan complete · No new alerts (${result.active_alerts || 0} active)`
      );
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to execute AML scan");
    } finally {
      setOverlayState(null);
    }
  };

  const handleWalletAdjust = async (payload: {
    userId: string;
    amount: number;
    reason: string;
    caseReference: string;
    pin: string;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: "Submitting wallet adjustment",
      submessage: "Recording the request for independent approval…",
    });
    try {
      const res = await AdminComplianceService.requestWalletAdjustment(payload);
      if (!res?.success) {
        toast.error(res?.error || "Wallet adjustment failed");
        return;
      }
      toast.success(res.status === "pending" ? "Submitted for independent approval" : `This request is already ${res.status}.`);
      setWalletDialogUser(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Wallet adjustment failed");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleUpdateUserStatus = async (
    userId: string,
    status: "active" | "paused" | "frozen" | "suspended",
    reason?: string
  ) => {
    if (userId === adminId && status !== "active") {
      toast.error("You cannot restrict your own administrator account.");
      return;
    }
    setActionPending(true);
    setOverlayState({
      message: status === "active" ? "Reactivating user account" : `Setting account to ${status}`,
      submessage: "Applying compliance state and notifying member…",
    });
    try {
      const res = await AdminComplianceService.updateUserStatus(userId, status, reason);
      if (!res?.success) {
        toast.error(res?.error || "Failed to update account status");
        return;
      }
      toast.success(`User status updated to ${status}`);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update account status");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleIssuePenalty = async (payload: {
    userId: string;
    amount: number;
    penaltyType: PenaltyType;
    reason: string;
    groupId?: string | null;
    amlAlertId?: string | null;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: "Recording compliance notice",
      submessage: "Saving the notice and audit entry…",
    });
    try {
      const res = await AdminComplianceService.issuePenalty(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to record the notice");
        return;
      }
      toast.success("Compliance notice recorded");
      setPenaltyDialogState({ open: false, user: null, amlAlertId: null });
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to record the notice");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleWaivePenalty = async (penalty: AdminPenaltyRecord) => {
    setActionPending(true);
    setOverlayState({
      message: "Closing compliance notice",
      submessage: "Updating the compliance record…",
    });
    try {
      const res = await AdminComplianceService.waivePenalty(
        penalty.id,
        "Closed by administrator"
      );
      if (!res?.success) {
        toast.error(res?.error || "Failed to close the notice");
        return;
      }
      toast.success("Compliance record closed");
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to close the notice");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleGroupControl = async (payload: {
    groupId: string;
    status: "active" | "paused" | "frozen" | "completed" | "cancelled";
    archived: boolean;
    reason: string;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: "Updating group governance",
      submessage: "Applying status update and notifying group creator…",
    });
    try {
      const res = await AdminComplianceService.updateGroupStatus(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to update group");
        return;
      }
      toast.success("Group governance updated");
      setGroupControlTarget(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update group");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleUpdateGroupSpotlight = async (payload: {
    groupId: string;
    isVerified: boolean;
    isPinned: boolean;
    spotlightLabel: string;
    featuredPriority: number;
    note: string;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: payload.isPinned ? "Pushing group to top of Discover" : "Updating verification badge",
      submessage: "Applying Verified Crowdfunder status & spotlight ranking…",
    });
    try {
      const res = await AdminComplianceService.updateGroupSpotlight(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to update group spotlight");
        return;
      }
      toast.success(
        payload.isPinned
          ? `Group pinned to top${payload.spotlightLabel ? ` as "${payload.spotlightLabel}"` : ""}!`
          : payload.isVerified
          ? "Verified Crowdfunder badge granted!"
          : "Group spotlight & badge updated"
      );
      setSpotlightGroupTarget(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update spotlight");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleToggleVerifiedOrganizer = async (payload: {
    userId: string;
    isVerified: boolean;
    badgeLabel: string;
    applyToGroups: boolean;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: payload.isVerified ? "Granting Verified Crowdfunder badge" : "Updating organizer badge",
      submessage: "Syncing badge status and notifying organizer…",
    });
    try {
      const res = await AdminComplianceService.toggleVerifiedOrganizer(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to update organizer verification");
        return;
      }
      toast.success(
        payload.isVerified
          ? `Verified Crowdfunder badge granted (${res.groups_updated || 0} pools synced)`
          : "Verified Crowdfunder badge removed"
      );
      setVerifyOrganizerTarget(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update organizer badge");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleUpdateAmlAlert = async (alertId: string, status: AmlAlertStatus, note: string) => {
    setActionPending(true);
    try {
      const res = await AdminComplianceService.updateAmlAlert(alertId, status, note);
      if (!res?.success) {
        toast.error(res?.error || "Failed to update AML alert");
        return;
      }
      toast.success(`AML case moved to ${status}`);
      setReviewingAlert(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update AML alert");
    } finally {
      setActionPending(false);
    }
  };

  const handleCreateManualFlag = async (payload: {
    userId: string;
    title: string;
    description: string;
    severity: AmlAlertSeverity;
    riskScore: number;
    amount: number;
  }) => {
    setActionPending(true);
    try {
      const res = await AdminComplianceService.createManualAmlAlert(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to create AML flag");
        return;
      }
      toast.success("Manual AML alert created");
      setManualFlagState({ open: false, user: null });
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create AML flag");
    } finally {
      setActionPending(false);
    }
  };

  const findLedgerReference = async () => {
    const reference = txQuery.trim();
    if (!reference || findingReference) return;
    setFindingReference(true);
    try {
      const transaction = await TransactionService.getTransactionByReference(reference);
      if (!transaction) {
        toast.error("No transaction found for that exact reference.");
        return;
      }
      const receipt = adminTransactionReceipt(transaction);
      if (receipt) {
        setReceiptData(receipt);
      } else {
        toast.info(transaction.type === "vote" ? "This reference is a governance vote." : "No payment receipt is available for this record.");
      }
    } catch {
      toast.error("Couldn’t look up that reference. Try again.");
    } finally {
      setFindingReference(false);
    }
  };

  const sectionActions = activeTab === "aml" ? (
    <>
      <Button onClick={() => void handleRunAmlScan()} disabled={Boolean(overlayState)}>
        <ScanSearch aria-hidden="true" /> Run AML scan
      </Button>
      <Button variant="outline" onClick={() => setManualFlagState({ open: true, user: null })}>
        <Flag aria-hidden="true" /> Flag activity
      </Button>
    </>
  ) : activeTab === "penalties" ? (
    <Button onClick={() => setPenaltyDialogState({ open: true, user: null, amlAlertId: null })}>
      <Gavel aria-hidden="true" /> Record notice
    </Button>
  ) : undefined;

  return (
    <div className="min-h-dvh bg-background">
      {overlayState && (
        <BrandLoader
          variant="overlay"
          message={overlayState.message}
          submessage={overlayState.submessage}
        />
      )}

      <AdminShell
        active={activeTab}
        href={sectionHref}
        name={user?.name?.trim() || "Administrator"}
        refreshing={refreshing}
        onRefresh={() => void loadPlatformData()}
        onSignOut={() => { void logout(); navigate("/", { replace: true }); }}
        actions={sectionActions}
      >
          <>
              <AdminView active={activeTab} value="operations">
                {user && <AdminOperationsOverview adminId={user.id} onOpen={section => navigate(sectionHref(section))} />}
              </AdminView>
              <AdminView active={activeTab} value="governance">
                {user && <AdminGroupGovernance adminId={user.id} />}
              </AdminView>
              <AdminView active={activeTab} value="aml" className="space-y-5">
                {/* Active AML Rule Engine Legend */}
                <div className="cp-card-native p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        Automated Anti-Money Laundering (AML) Rules Engine
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Detects CBN-style red flags across deposits, pool transfers, and withdrawals.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {[
                      "Mandatory Unique BVN for Group Creation",
                      "Single Tx ≥ ₦500,000",
                      "Structuring / Smurfing (3+ split txs ≥ ₦400k/day)",
                      "Velocity Burst (≥ 5 txs/hr)",
                      "Rapid Pass-Through (≥ 80% outflow < 2h)",
                      "Unverified KYC Volume (No BVN ≥ ₦250k/30d)",
                      "Outside / External Payment ≥ ₦250k Screened",
                      "Rapid Group Churn Guard (Max 3/24h)",
                    ].map((rule) => (
                      <span
                        key={rule}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(["active", "all", "open", "investigating", "escalated", "resolved", "dismissed"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setAmlStatusFilter(st)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                            amlStatusFilter === st
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {st === "active" ? "Active Queue" : st}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setAmlSeverityFilter(sev)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
                          amlSeverityFilter === sev
                            ? "border-foreground bg-foreground text-background"
                            : "bg-card text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alert Cards */}
                {alerts.loaded && alerts.rows.length === 0 ? (
                  <div className="cp-card-native flex flex-col items-center justify-center px-6 py-14 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
                      <ShieldCheck className="h-7 w-7" />
                    </span>
                    <h3 className="mt-3 text-base font-bold text-foreground">
                      No AML alerts in this queue
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Run an on-demand AML scan to inspect recent transactions or create a manual compliance flag.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={handleRunAmlScan} className="rounded-xl gap-1.5">
                        <ScanSearch className="h-4 w-4" />
                        Run AML Scan
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setManualFlagState({ open: true, user: null })}
                        className="rounded-xl gap-1.5"
                      >
                        <Flag className="h-4 w-4" />
                        Manual Flag
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.rows.map((alert) => (
                      <div
                        key={alert.id}
                        className="cp-card-native flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase",
                                severityBadgeStyle(alert.severity)
                              )}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {alert.severity} · Risk {alert.risk_score}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                                amlStatusBadgeStyle(alert.status)
                              )}
                            >
                              {alert.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {safeFormatDate(alert.created_at)}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-foreground">{alert.title}</h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {alert.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <span className="font-semibold text-foreground">
                              Subject: {alert.user_profile?.name || alert.user_profile?.email || "Unknown"}
                            </span>
                            {Number(alert.amount || 0) > 0 && (
                              <span className="font-bold text-primary tabular-nums">
                                Exposure: {formatNaira(alert.amount)}
                              </span>
                            )}
                            {alert.user_profile?.status && alert.user_profile.status !== "active" && (
                              <Badge variant="destructive" className="text-[10px] capitalize">
                                Account {alert.user_profile.status}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                          <Button
                            size="sm"
                            onClick={() => setReviewingAlert(alert)}
                            className="h-9 rounded-xl font-semibold"
                          >
                            Review Case
                          </Button>
                          {alert.user_id && alert.user_id !== adminId && alert.user_profile?.status !== "frozen" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleUpdateUserStatus(
                                  alert.user_id!,
                                  "frozen",
                                  `AML freeze: ${alert.title}`
                                )
                              }
                              className="h-9 gap-1 rounded-xl border-destructive/35 text-destructive hover:bg-destructive/10"
                            >
                              <Snowflake className="h-3.5 w-3.5" />
                              Freeze
                            </Button>
                          )}
                          {alert.user_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openNoticeForAlert(alert)}
                              className="h-9 gap-1 rounded-xl"
                            >
                              <Gavel className="h-3.5 w-3.5" />
                              Notice
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AdminPageControls listing={alerts} label="AML alerts" />
              </AdminView>

              {/* ================================================================
                  TAB 1B: OUTSIDE / EXTERNAL PAYMENT TRACKING & AML SCREENING
                 ================================================================ */}
              <AdminView active={activeTab} value="external" className="space-y-4">
                <div className="cp-card-native space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        External &amp; Outside Payment Tracker
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Every outside bank transfer, virtual account credit, and third-party checkout is automatically logged, masked, and AML-scored.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by sender name, bank, reference, or group…"
                        maxLength={120}
                        value={extQuery}
                        onChange={(e) => setExtQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "unverified", "flagged", "blocked", "verified"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setExtFilter(st)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                            extFilter === st
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/30 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {outsidePayments.loaded && outsidePayments.rows.length === 0 ? (
                  <div className="cp-card-native py-14 text-center">
                    <Building2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      No external payments in this view
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Outside bank transfers and Flutterwave checkouts will appear here automatically via webhook tracking.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outsidePayments.rows.map((ep) => (
                      <div
                        key={ep.id}
                        className="cp-card-native flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase",
                                severityBadgeStyle(ep.aml_risk_level)
                              )}
                            >
                              {ep.aml_risk_level} risk
                            </span>
                            <Badge
                              variant={
                                ep.verification_status === "blocked" || ep.verification_status === "flagged"
                                  ? "destructive"
                                  : ep.verification_status === "verified"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {ep.verification_status}
                            </Badge>
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                              {ep.source_channel.replace(/_/g, " ")}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {safeFormatDate(ep.created_at)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="text-base font-extrabold text-foreground tabular-nums">
                              {formatNaira(ep.amount)}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              From: {ep.sender_name || "Unidentified External Sender"}
                            </span>
                            {ep.sender_bank && (
                              <span className="text-xs text-muted-foreground">
                                ({ep.sender_bank}
                                {ep.sender_account_masked ? ` · ${ep.sender_account_masked}` : ""})
                              </span>
                            )}
                          </div>

                          <p className="truncate text-xs text-muted-foreground">
                            {ep.group?.name ? `Pool: ${ep.group.name} · ` : ""}
                            {ep.user_profile?.name ? `Account: ${ep.user_profile.name} · ` : ""}
                            Ref: <span className="font-mono">{ep.reference_id || ep.id.slice(0, 12)}</span>
                          </p>

                          {Array.isArray(ep.aml_flags) && ep.aml_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {ep.aml_flags.map((flag) => (
                                <span
                                  key={flag}
                                  className="rounded-md bg-amber-500/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 dark:text-amber-300"
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 lg:shrink-0">
                          {ep.verification_status !== "verified" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionPending}
                              onClick={() => handleReviewExternalPayment(ep.id, "verified")}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              Verify
                            </Button>
                          )}
                          {ep.verification_status !== "flagged" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionPending}
                              onClick={() => handleReviewExternalPayment(ep.id, "flagged")}
                              className="h-9 gap-1 rounded-xl border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              Flag AML
                            </Button>
                          )}
                          {ep.verification_status !== "blocked" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionPending}
                              onClick={() => handleReviewExternalPayment(ep.id, "blocked")}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Block
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AdminPageControls listing={outsidePayments} label="outside payments" />
              </AdminView>

              {/* ================================================================
                  TAB 2: USER & KYC MANAGEMENT
                 ================================================================ */}
              <AdminView active={activeTab} value="users" className="space-y-4">
                {user && <AdminWalletAdjustments adminId={user.id} onSettled={loadPlatformData} />}
                <div className="cp-card-native p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, or phone…"
                        maxLength={120}
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "active", label: "Active" },
                          { id: "paused", label: "Paused" },
                          { id: "frozen", label: "Frozen" },
                          { id: "no_bvn", label: "Unverified BVN" },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setUserStatusFilter(f.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            userStatusFilter === f.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/30 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {users.rows.map((u) => {
                    const { has_pin: hasPin, has_bvn: hasBvn } = u;
                    const status = u.status || "active";
                    const isRestricted = status !== "active";

                    return (
                      <div
                        key={u.id}
                        className="cp-card-native flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <Avatar className="h-11 w-11 shrink-0 border">
                            <AvatarImage src={u.profile_image || undefined} />
                            <AvatarFallback className="bg-accent font-bold text-primary">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-foreground">
                                {u.name || "Unnamed User"}
                              </p>
                              <Badge
                                variant={isRestricted ? "destructive" : "outline"}
                                className="text-[10px] capitalize"
                              >
                                {status}
                              </Badge>
                              {u.role === "admin" && (
                                <Badge className="text-[10px]">Admin</Badge>
                              )}
                              {u.is_verified_organizer && (
                                <VerifiedCrowdfunderBadge
                                  label={u.organizer_badge_label || "Verified Crowdfunder"}
                                />
                              )}
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  hasBvn
                                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                    : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                                )}
                              >
                                {hasBvn ? "BVN Verified" : "No BVN"}
                              </span>
                              {hasPin && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  PIN Active
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {u.email} {u.phone ? `· ${u.phone}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                          <div className="text-left lg:mr-3 lg:text-right">
                            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                              Wallet Balance
                            </span>
                            <span className="text-base font-extrabold tabular-nums text-foreground">
                              {formatNaira(u.wallet_balance)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" className="h-9 gap-1 rounded-xl text-xs"
                              aria-label={`Transaction history for ${accountEntity(u).name}`}
                              onClick={event => {
                                historyTrigger.current = event.currentTarget;
                                setHistoryAccount(accountEntity(u));
                              }}>
                              <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                              Transaction history
                            </Button>
                            <Button
                              size="sm"
                              variant={u.is_verified_organizer ? "secondary" : "outline"}
                              onClick={() => setVerifyOrganizerTarget(u)}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                              {u.is_verified_organizer ? "Verified" : "Verify Badge"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setWalletDialogUser(u)}
                              disabled={u.id === user?.id}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Request debit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPenaltyDialogState({ open: true, user: accountEntity(u), amlAlertId: null })
                              }
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Gavel className="h-3.5 w-3.5" />
                              Notice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setManualFlagState({ open: true, user: accountEntity(u) })}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              AML
                            </Button>
                            {u.id !== adminId && (isRestricted ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleUpdateUserStatus(u.id, "active", "Reactivated by Super Admin")
                                }
                                className="h-9 gap-1 rounded-xl text-xs"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Activate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  handleUpdateUserStatus(u.id, "frozen", "Account frozen by Super Admin")
                                }
                                className="h-9 gap-1 rounded-xl text-xs"
                              >
                                <Snowflake className="h-3.5 w-3.5" />
                                Freeze
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {users.loaded && users.rows.length === 0 && (
                    <div className="cp-card-native py-12 text-center text-sm text-muted-foreground">
                      No users match your filter criteria.
                    </div>
                  )}
                </div>
                <AdminPageControls listing={users} label="accounts" />
              </AdminView>

              {/* ================================================================
                  TAB 3: GROUPS GOVERNANCE & OPERATIONS
                 ================================================================ */}
              <AdminView active={activeTab} value="groups" className="space-y-5">
                <div className="cp-card-native p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search pools by name, category, or creator…"
                        maxLength={120}
                        value={groupQuery}
                        onChange={(e) => setGroupQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "pinned", label: "Pinned / Top" },
                          { id: "verified", label: "Verified" },
                          { id: "active", label: "Active" },
                          { id: "restricted", label: "Paused / Frozen" },
                          { id: "archived", label: "Archived" },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setGroupFilter(f.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            groupFilter === f.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/30 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {groups.rows.map((group) => {
                    const current = Number(group.current_amount || 0);
                    const target = Math.max(1, Number(group.target_amount || 1));
                    const pct = Math.min(100, Math.round((current / target) * 100));
                    const memberCount = group.member_count;
                    const status = group.status || "active";

                    return (
                      <div key={group.id} className="cp-card-native flex flex-col justify-between p-5">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                                <CategoryIcon category={group.category} size={20} />
                              </span>
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-bold text-foreground">
                                  {group.name}
                                </h3>
                                <p className="truncate text-xs text-muted-foreground">
                                  By {group.profiles?.name || group.profiles?.email || "Member"} ·{" "}
                                  <span className="capitalize">{group.frequency}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1">
                              {(group.is_pinned || group.spotlight_label) && (
                                <SpotlightBadge
                                  label={group.spotlight_label}
                                  isPinned={Boolean(group.is_pinned)}
                                />
                              )}
                              {group.is_verified && <VerifiedCrowdfunderBadge />}
                              <Badge
                                variant={
                                  status === "frozen" || status === "paused" || status === "cancelled"
                                    ? "destructive"
                                    : "outline"
                                }
                                className="capitalize"
                              >
                                {status}
                              </Badge>
                              {group.archived && (
                                <Badge variant="secondary" className="gap-1">
                                  <Archive className="h-3 w-3" /> Archived
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-foreground tabular-nums">
                                {formatNaira(current)}{" "}
                                <span className="font-normal text-muted-foreground">
                                  / {formatNaira(group.target_amount)}
                                </span>
                              </span>
                              <span className="font-bold text-primary tabular-nums">{pct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5">
                              <Users className="h-3 w-3" /> {memberCount} member
                              {memberCount === 1 ? "" : "s"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 capitalize">
                              {group.privacy === "private" ? (
                                <Lock className="h-3 w-3" />
                              ) : (
                                <Globe className="h-3 w-3" />
                              )}
                              {group.privacy || "public"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5">
                              <Vote className="h-3 w-3" />
                              {group.enable_voting_rights !== false
                                ? `Vote (${group.voting_threshold || 60}%)`
                                : "Admin Direct"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/groups/${group.id}`)}
                            className="h-9 gap-1.5 rounded-xl text-xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Inspect
                          </Button>
                          <Button
                            size="sm"
                            variant={group.is_pinned || group.is_verified ? "secondary" : "default"}
                            onClick={() => setSpotlightGroupTarget(group)}
                            className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-bold"
                          >
                            {group.is_pinned ? (
                              <Pin className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Flame className="h-3.5 w-3.5" />
                            )}
                            {group.is_pinned || group.is_verified ? "Edit Spotlight" : "Verify / Push Top"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setGroupControlTarget(group)}
                            className="h-9 gap-1.5 rounded-xl text-xs"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {groups.loaded && groups.rows.length === 0 && (
                    <div className="cp-card-native col-span-full py-12 text-center text-sm text-muted-foreground">
                      No contribution groups match your search.
                    </div>
                  )}
                </div>
                <AdminPageControls listing={groups} label="groups" />
              </AdminView>

              {/* ================================================================
                  TAB 4: PENALTIES LEDGER
                 ================================================================ */}
              <AdminView active={activeTab} value="penalties" className="space-y-4">
                <p className="text-sm text-muted-foreground">Record account issues and notify customers. Recording or closing a notice leaves their wallet balance unchanged.</p>
                <Input type="search" maxLength={120} aria-label="Search compliance notices" placeholder="Find by account or reason"
                  value={noticeQuery} onChange={event => setNoticeQuery(event.target.value)} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "applied", "pending", "waived"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPenaltyFilter(st)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                          penaltyFilter === st
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {noticeStatuses[st]}
                      </button>
                    ))}
                  </div>

                </div>

                {notices.loaded && notices.rows.length === 0 ? (
                  <div className="cp-card-native py-14 text-center">
                    <Gavel className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      No compliance records found
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      New notices and historical records appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notices.rows.map((p) => (
                      <div
                        key={p.id}
                        className="cp-card-native flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                p.status === "waived"
                                  ? "secondary"
                                  : p.status === "pending"
                                  ? "outline"
                                  : "destructive"
                              }
                              className="capitalize"
                            >
                              {noticeStatuses[p.status]}
                            </Badge>
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-foreground">
                              {p.penalty_type.replace(/_/g, " ")}
                            </span>
                            {p.deducted_from_wallet && (
                              <span className="text-[11px] font-semibold text-primary">
                                Historical wallet debit
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground">
                            {p.user_profile?.name || p.user_profile?.email || "User"}
                            {p.group?.name && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · Pool: {p.group.name}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.reason}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Recorded {safeFormatDate(p.created_at)}
                            {p.waived_at ? ` · Closed ${safeFormatDate(p.waived_at)}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:flex-col sm:items-end">
                          {p.amount > 0 && <span className="text-sm font-semibold tabular-nums">
                            {p.deducted_from_wallet ? "Original debit" : "Reference amount"} · {formatNaira(p.amount)}
                          </span>}
                          {p.status !== "waived" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionPending}
                              onClick={() => handleWaivePenalty(p)}
                              className="h-9 rounded-xl text-xs"
                            >
                              Close record
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AdminPageControls listing={notices} label="compliance notices" />
              </AdminView>

              {/* ================================================================
                  TAB 5: PLATFORM LEDGER & RECEIPTS
                 ================================================================ */}
              <AdminView active={activeTab} value="ledger" className="space-y-4">
                <div className="cp-card-native space-y-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="Search recent transactions or enter an exact reference"
                        placeholder="Search recent transactions…"
                        value={txQuery}
                        maxLength={180}
                        onChange={(e) => setTxQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <Button variant="outline" disabled={!txQuery.trim() || findingReference} onClick={() => void findLedgerReference()}>
                      {findingReference ? "Looking up…" : "Find exact reference"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setHighValueOnly((v) => !v)}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold",
                        highValueOnly
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : "bg-muted/30 text-foreground hover:bg-accent"
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      High Value (≥ ₦500k)
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {["all", "deposit", "contribution", "transfer", "withdrawal", "refund", "payment"].map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTxTypeFilter(t)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                            txTypeFilter === t
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/30 text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="cp-card-native divide-y divide-border/70 overflow-hidden">
                  {transactions.rows.map((tx) => {
                    const receipt = adminTransactionReceipt(tx);
                    const Row = receipt ? "button" : "div";
                    const isCredit = tx.type === "deposit" || tx.type === "refund";
                    const isHighValue = receipt && Number(tx.amount || 0) >= HIGH_VALUE_THRESHOLD;

                    return (
                      <Row
                        key={tx.id}
                        type={receipt ? "button" : undefined}
                        onClick={receipt ? () => setReceiptData(receipt) : undefined}
                        className={cn("flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left", receipt && "transition-colors hover:bg-muted/45")}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                              isCredit
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {tx.type === "vote" ? (
                              <Vote className="h-4.5 w-4.5" />
                            ) : isCredit ? (
                              <ArrowDownLeft className="h-4.5 w-4.5" />
                            ) : (
                              <ArrowUpRight className="h-4.5 w-4.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-bold capitalize text-foreground">
                                {receipt?.title || (tx.type === "vote" ? "Governance vote" : tx.type)}
                              </span>
                              {isHighValue && (
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                                  AML Threshold
                                </span>
                              )}
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                {tx.status || "unknown"}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {tx.profiles?.name || tx.profiles?.email || "User"} ·{" "}
                              {tx.description || tx.contribution_groups?.name || tx.reference_id}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {receipt && <p
                            className={cn(
                              "text-sm font-extrabold tabular-nums",
                              isCredit ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                            )}
                          >
                            {isCredit ? "+" : "-"}
                            {formatNaira(tx.amount)}
                          </p>}
                          <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                            {receipt && <ReceiptText className="h-3 w-3" />}
                            {safeFormatDate(tx.created_at, "MMM d, h:mm a")}
                          </p>
                        </div>
                      </Row>
                    );
                  })}

                  {transactions.loaded && transactions.rows.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No transactions match your current filters.
                    </div>
                  )}
                </div>
                <AdminPageControls listing={transactions} label="transactions" />
              </AdminView>

              {/* ================================================================
                  TAB 6: COMPLIANCE AUDIT TRAIL
                 ================================================================ */}
              <AdminView active={activeTab} value="audit" className="space-y-4">
                <div className="cp-card-native p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter audit log by action, admin, or summary…"
                      maxLength={120}
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>
                </div>

                <div className="cp-card-native divide-y divide-border/70 overflow-hidden">
                  {audits.rows.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {log.action}
                          </Badge>
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                            {log.target_type}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{log.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          Actor: {log.admin_profile?.name || log.admin_profile?.email || "System"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {safeFormatDate(log.created_at, "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}

                  {audits.loaded && audits.rows.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No audit entries yet. Actions taken in this console are logged automatically.
                    </div>
                  )}
                </div>
                <AdminPageControls listing={audits} label="audit records" />
              </AdminView>

              {/* ================================================================
                  TAB 7: FLUTTERWAVE GATEWAY & WEBHOOK SETTINGS
                 ================================================================ */}
              <AdminView active={activeTab} value="gateway" className="space-y-4">
                <AdminPayoutHealth />
                <AdminPaymentReviews />
                <AdminPaymentAlertSounds />
                <AdminPaymentSettings onSettingsSaved={() => void loadPlatformData()} />
              </AdminView>
              <AdminView active={activeTab} value="pricing" className="space-y-4">
                <AdminPricingRevenue />
                <AdminWalletBankBonus />
              </AdminView>
              <AdminView active={activeTab} value="volume"><AdminTransactionAnalytics /></AdminView>
              <AdminView active={activeTab} value="bulk-transfers"><AdminBulkTransfers /></AdminView>
              <AdminView active={activeTab} value="ice-vault"><AdminIceVault /></AdminView>
              <AdminView active={activeTab} value="support"><SupportInbox admin selected={supportTicket} onSelect={setSupportTicket} /></AdminView>
          </>
      </AdminShell>

      {/* MODALS */}
      <WalletAdjustDialog
        open={Boolean(walletDialogUser)}
        onOpenChange={(open) => !open && setWalletDialogUser(null)}
        user={walletDialogUser}
        pending={actionPending}
        onConfirm={handleWalletAdjust}
      />

      <IssuePenaltyDialog
        open={penaltyDialogState.open}
        onOpenChange={(open) =>
          !open && setPenaltyDialogState({ open: false, user: null, amlAlertId: null })
        }
        presetUser={penaltyDialogState.user}
        presetAmlAlertId={penaltyDialogState.amlAlertId}
        pending={actionPending}
        onConfirm={handleIssuePenalty}
      />

      <GroupControlDialog
        open={Boolean(groupControlTarget)}
        onOpenChange={(open) => !open && setGroupControlTarget(null)}
        group={groupControlTarget}
        pending={actionPending}
        onConfirm={handleGroupControl}
      />

      <GroupSpotlightDialog
        open={Boolean(spotlightGroupTarget)}
        onOpenChange={(open) => !open && setSpotlightGroupTarget(null)}
        group={spotlightGroupTarget}
        pending={actionPending}
        onConfirm={handleUpdateGroupSpotlight}
      />

      <VerifyOrganizerDialog
        open={Boolean(verifyOrganizerTarget)}
        onOpenChange={(open) => !open && setVerifyOrganizerTarget(null)}
        user={verifyOrganizerTarget}
        pending={actionPending}
        onConfirm={handleToggleVerifiedOrganizer}
      />

      <AmlReviewDialog
        open={Boolean(reviewingAlert)}
        onOpenChange={(open) => !open && setReviewingAlert(null)}
        alert={reviewingAlert}
        pending={actionPending}
        onUpdateStatus={handleUpdateAmlAlert}
        canFreezeUser={Boolean(reviewingAlert?.user_id && reviewingAlert.user_id !== adminId)}
        onFreezeUser={async (uid, reason) => {
          await handleUpdateUserStatus(uid, "frozen", reason);
          setReviewingAlert(null);
        }}
        onOpenPenaltyForAlert={openNoticeForAlert}
      />

      <ManualAmlFlagDialog
        open={manualFlagState.open}
        onOpenChange={(open) => !open && setManualFlagState({ open: false, user: null })}
        presetUser={manualFlagState.user}
        pending={actionPending}
        onConfirm={handleCreateManualFlag}
      />

      {user && historyAccount && <AdminUserTransactionHistory key={historyAccount.id}
        adminId={user.id} account={historyAccount}
        onClose={() => setHistoryAccount(null)} returnFocus={() => historyTrigger.current?.focus()} />}

      <Dialog open={Boolean(receiptData)} onOpenChange={(open) => !open && setReceiptData(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-h-[92dvh] max-w-[29rem] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction Receipt</DialogTitle>
          </DialogHeader>
          {receiptData && (
            <CollectiPayReceipt
              data={receiptData}
              onDone={() => setReceiptData(null)}
              doneLabel="Close receipt"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
