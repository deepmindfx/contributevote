import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flag,
  Flame,
  Gavel,
  Globe,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  Pin,
  Play,
  ReceiptText,
  RefreshCw,
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
import Header from "@/components/layout/Header";
import BrandLoader, { CollectiPayMark } from "@/components/ui/BrandLoader";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CollectiPayReceipt, { type CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { ContributionService } from "@/services/supabase/contributionService";
import { TransactionService } from "@/services/supabase/transactionService";
import {
  AdminComplianceService,
  type AdminAuditLogRecord,
  type AdminPenaltyRecord,
  type AdminWithdrawalRecord,
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
  RemoveBvnDialog,
  VerifyOrganizerDialog,
  WalletAdjustDialog,
} from "@/components/admin/AdminActionDialogs";
import { FlipCounterHero } from "@/components/admin/FlipCounterHero";
import { AdminPaymentSettings } from "@/components/admin/AdminPaymentSettings";
import { AdminPaymentAlertSounds } from "@/components/admin/AdminPaymentAlertSounds";
import { AdminPricingRevenue } from "@/components/admin/AdminPricingRevenue";
import { AdminTransactionAnalytics } from "@/components/admin/AdminTransactionAnalytics";
import { AdminWalletBankBonus } from "@/components/admin/AdminWalletBankBonus";
import { AdminIceVault } from "@/components/admin/AdminIceVault";
import { hasTransactionPin } from "@/lib/transactionPin";
import {
  SpotlightBadge,
  VerifiedCrowdfunderBadge,
} from "@/components/contribution/VerifiedCrowdfunderBadge";
import { cn } from "@/lib/utils";

const HIGH_VALUE_THRESHOLD = 500000;

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
  const { users, refreshUserData } = useSupabaseUser();
  const navigate = useNavigate();

  // Platform datasets
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [amlAlerts, setAmlAlerts] = useState<AmlAlertRecord[]>([]);
  const [penalties, setPenalties] = useState<AdminPenaltyRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [externalPayments, setExternalPayments] = useState<ExternalPaymentTrackRecord[]>([]);
  const [extFilter, setExtFilter] = useState<"all" | "unverified" | "flagged" | "blocked" | "verified">("all");
  const [extQuery, setExtQuery] = useState("");
  const [loadingPlatformData, setLoadingPlatformData] = useState(true);

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
  const [txQuery, setTxQuery] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [highValueOnly, setHighValueOnly] = useState(false);
  const [auditQuery, setAuditQuery] = useState("");

  // Dialog states
  const [walletDialogUser, setWalletDialogUser] = useState<any | null>(null);
  const [penaltyDialogState, setPenaltyDialogState] = useState<{
    open: boolean;
    user: any | null;
    amlAlertId?: string | null;
  }>({ open: false, user: null, amlAlertId: null });
  const [groupControlTarget, setGroupControlTarget] = useState<any | null>(null);
  const [spotlightGroupTarget, setSpotlightGroupTarget] = useState<any | null>(null);
  const [verifyOrganizerTarget, setVerifyOrganizerTarget] = useState<any | null>(null);
  const [removeBvnTarget, setRemoveBvnTarget] = useState<any | null>(null);
  const [reviewingAlert, setReviewingAlert] = useState<AmlAlertRecord | null>(null);
  const [manualFlagState, setManualFlagState] = useState<{ open: boolean; user: any | null }>({
    open: false,
    user: null,
  });
  const [receiptData, setReceiptData] = useState<CollectiPayReceiptData | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const loadPlatformData = useCallback(async () => {
    setLoadingPlatformData(true);
    try {
      const [groupsRes, txRes, alertsRes, penaltiesRes, logsRes, wdRes, extRes] = await Promise.allSettled([
        ContributionService.getContributionGroups(),
        TransactionService.getTransactions(),
        AdminComplianceService.getAmlAlerts(),
        AdminComplianceService.getPenalties(),
        AdminComplianceService.getAuditLogs(),
        AdminComplianceService.getPendingWithdrawals(),
        AdminComplianceService.getExternalPayments(),
        refreshUserData(),
      ]);

      if (groupsRes.status === "fulfilled") setAllGroups(groupsRes.value || []);
      if (txRes.status === "fulfilled") setAllTransactions(txRes.value || []);
      if (alertsRes.status === "fulfilled") setAmlAlerts(alertsRes.value || []);
      if (penaltiesRes.status === "fulfilled") setPenalties(penaltiesRes.value || []);
      if (logsRes.status === "fulfilled") setAuditLogs(logsRes.value || []);
      if (wdRes.status === "fulfilled") setWithdrawals(wdRes.value || []);
      if (extRes.status === "fulfilled") setExternalPayments(extRes.value || []);
    } catch (error) {
      console.error("Error loading admin command center:", error);
      toast.error("Failed to sync platform operations data");
    } finally {
      setLoadingPlatformData(false);
    }
  }, [refreshUserData]);

  useEffect(() => {
    loadPlatformData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription so the Mechanical Flip-Board User Counter flips live on new signups
  useEffect(() => {
    const channel = supabase
      .channel("admin-live-user-counter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => {
          void refreshUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshUserData]);

  // Executive KPIs
  const totalWalletFloat = useMemo(
    () => users.reduce((sum, u) => sum + Number(u.wallet_balance || 0), 0),
    [users]
  );
  const totalGroupLiquidity = useMemo(
    () => allGroups.reduce((sum, g) => sum + Number(g.current_amount || 0), 0),
    [allGroups]
  );
  const activeAmlAlerts = useMemo(
    () => amlAlerts.filter((a) => ["open", "investigating", "escalated"].includes(a.status)),
    [amlAlerts]
  );
  const criticalAmlCount = useMemo(
    () => activeAmlAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length,
    [activeAmlAlerts]
  );
  const restrictedUsersCount = useMemo(
    () => users.filter((u) => u.status && u.status !== "active").length,
    [users]
  );
  const bvnVerifiedCount = useMemo(
    () => users.filter((u) => u.bvn && String(u.bvn).trim().length >= 11).length,
    [users]
  );
  const pendingWithdrawalsCount = useMemo(
    () => withdrawals.filter((w) => w.status === "pending").length,
    [withdrawals]
  );
  const activePenaltiesSum = useMemo(
    () =>
      penalties
        .filter((p) => p.status !== "waived")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [penalties]
  );

  // Filtered datasets
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q);
      if (!matchesQ) return false;
      if (userStatusFilter === "active") return !u.status || u.status === "active";
      if (userStatusFilter === "paused") return u.status === "paused";
      if (userStatusFilter === "frozen") return u.status === "frozen" || u.status === "suspended";
      if (userStatusFilter === "no_bvn") return !u.bvn || String(u.bvn).trim().length < 11;
      return true;
    });
  }, [users, userQuery, userStatusFilter]);

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    return allGroups.filter((g) => {
      const matchesQ =
        !q ||
        g.name?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q) ||
        g.profiles?.name?.toLowerCase().includes(q);
      if (!matchesQ) return false;
      if (groupFilter === "active") return !g.archived && (!g.status || g.status === "active");
      if (groupFilter === "verified") return Boolean(g.is_verified);
      if (groupFilter === "pinned") return Boolean(g.is_pinned || g.spotlight_label);
      if (groupFilter === "restricted") return g.status === "paused" || g.status === "frozen";
      if (groupFilter === "archived") return Boolean(g.archived);
      return true;
    });
  }, [allGroups, groupQuery, groupFilter]);

  const filteredAlerts = useMemo(() => {
    return amlAlerts.filter((a) => {
      if (amlStatusFilter === "active") {
        if (!["open", "investigating", "escalated"].includes(a.status)) return false;
      } else if (amlStatusFilter !== "all" && a.status !== amlStatusFilter) {
        return false;
      }
      if (amlSeverityFilter !== "all" && a.severity !== amlSeverityFilter) return false;
      return true;
    });
  }, [amlAlerts, amlStatusFilter, amlSeverityFilter]);

  const filteredPenalties = useMemo(() => {
    if (penaltyFilter === "all") return penalties;
    return penalties.filter((p) => p.status === penaltyFilter);
  }, [penalties, penaltyFilter]);

  const filteredTransactions = useMemo(() => {
    const q = txQuery.trim().toLowerCase();
    return allTransactions.filter((tx) => {
      if (txTypeFilter !== "all" && tx.type !== txTypeFilter) return false;
      if (highValueOnly && Number(tx.amount || 0) < HIGH_VALUE_THRESHOLD) return false;
      if (!q) return true;
      return (
        tx.description?.toLowerCase().includes(q) ||
        tx.reference_id?.toLowerCase().includes(q) ||
        tx.profiles?.name?.toLowerCase().includes(q) ||
        tx.profiles?.email?.toLowerCase().includes(q) ||
        tx.contribution_groups?.name?.toLowerCase().includes(q)
      );
    });
  }, [allTransactions, txQuery, txTypeFilter, highValueOnly]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.summary.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target_type.toLowerCase().includes(q) ||
        log.admin_profile?.name?.toLowerCase().includes(q)
    );
  }, [auditLogs, auditQuery]);

  const filteredExternalPayments = useMemo(() => {
    const q = extQuery.trim().toLowerCase();
    return externalPayments.filter((ep) => {
      if (extFilter !== "all" && ep.verification_status !== extFilter) return false;
      if (!q) return true;
      return (
        ep.sender_name?.toLowerCase().includes(q) ||
        ep.sender_bank?.toLowerCase().includes(q) ||
        ep.reference_id?.toLowerCase().includes(q) ||
        ep.group?.name?.toLowerCase().includes(q) ||
        ep.narration?.toLowerCase().includes(q)
      );
    });
  }, [externalPayments, extFilter, extQuery]);

  const unverifiedExternalCount = useMemo(
    () => externalPayments.filter((ep) => ep.verification_status === "unverified" || ep.verification_status === "flagged").length,
    [externalPayments]
  );

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
    direction: "credit" | "debit";
    reason: string;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: payload.direction === "credit" ? "Crediting user wallet" : "Debiting user wallet",
      submessage: "Updating ledger balance and recording audit trail…",
    });
    try {
      const res = await AdminComplianceService.adjustUserWallet(payload);
      if (!res?.success) {
        toast.error(res?.error || "Wallet adjustment failed");
        return;
      }
      toast.success(
        `${payload.direction === "credit" ? "Credited" : "Debited"} ${formatNaira(payload.amount)}`
      );
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
    deductWallet: boolean;
    groupId?: string | null;
    amlAlertId?: string | null;
  }) => {
    setActionPending(true);
    setOverlayState({
      message: "Issuing compliance penalty",
      submessage: "Recording fine, adjusting balance, and logging audit entry…",
    });
    try {
      const res = await AdminComplianceService.issuePenalty(payload);
      if (!res?.success) {
        toast.error(res?.error || "Failed to issue penalty");
        return;
      }
      toast.success(
        res.deducted_from_wallet
          ? `Penalty of ${formatNaira(payload.amount)} deducted from wallet`
          : `Penalty of ${formatNaira(payload.amount)} logged as pending settlement`
      );
      setPenaltyDialogState({ open: false, user: null, amlAlertId: null });
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to issue penalty");
    } finally {
      setActionPending(false);
      setOverlayState(null);
    }
  };

  const handleWaivePenalty = async (penalty: AdminPenaltyRecord) => {
    setActionPending(true);
    setOverlayState({
      message: "Waiving compliance penalty",
      submessage: penalty.deducted_from_wallet
        ? "Refunding fine back to user wallet…"
        : "Updating penalty record…",
    });
    try {
      const res = await AdminComplianceService.waivePenalty(
        penalty.id,
        penalty.deducted_from_wallet,
        "Waived via Super Admin Command Center"
      );
      if (!res?.success) {
        toast.error(res?.error || "Failed to waive penalty");
        return;
      }
      toast.success(
        res.refunded
          ? `Penalty waived & ${formatNaira(penalty.amount)} refunded to wallet`
          : "Penalty waived"
      );
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to waive penalty");
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

  const handleRemoveUserBvn = async (payload: { userId: string; reason: string }) => {
    setActionPending(true);
    setOverlayState({
      message: "Unlinking BVN from user profile",
      submessage: "Clearing KYC record, notifying user, and recording audit trail…",
    });
    try {
      const res = await AdminComplianceService.removeUserBvn(payload.userId, payload.reason);
      if (!res?.success) {
        toast.error(res?.error || "Failed to unlink BVN");
        return;
      }
      toast.success(res.message || "BVN unlinked from user account");
      setRemoveBvnTarget(null);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to unlink BVN");
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

  const openTransactionReceipt = (tx: any) => {
    const kindMap: Record<string, CollectiPayReceiptData["kind"]> = {
      deposit: "deposit",
      withdrawal: "withdrawal",
      transfer: "transfer",
      contribution: "contribution",
      refund: "refund",
      payment: "transfer",
    };

    setReceiptData({
      kind: kindMap[tx.type] || "transfer",
      title: tx.metadata?.category === "admin_penalty" ? "Compliance Penalty" : undefined,
      amount: Number(tx.amount || 0),
      status: tx.status || "completed",
      date: tx.created_at,
      reference: tx.reference_id || tx.id,
      transactionId: tx.id,
      groupName: tx.contribution_groups?.name || undefined,
      paymentMethod: tx.payment_method || "Wallet",
      narration: tx.description || undefined,
      balanceBefore: typeof tx.balance_before === "number" ? tx.balance_before : undefined,
      balanceAfter: typeof tx.balance_after === "number" ? tx.balance_after : undefined,
      sender: {
        label: "Account Holder",
        name: tx.profiles?.name || tx.profiles?.email || "CollectiPay Member",
        subtitle: tx.profiles?.email || undefined,
      },
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      {overlayState && (
        <BrandLoader
          variant="overlay"
          message={overlayState.message}
          submessage={overlayState.submessage}
        />
      )}

      <Header mobilePanel />

      <main className="app-page app-panel-page cp-page-enter max-w-7xl">
        {/* Deep-Emerald Super Admin Command Center Hero */}
        <section className="app-panel-hero" aria-labelledby="super-admin-heading">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 shrink-0 rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm">
                <CollectiPayMark size={38} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#dbf5b4] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#0c3027]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Super Admin
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#d7f5e5]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#dbf5b4]" />
                    Live Fintech &amp; AML Ops
                  </span>
                </div>
                <h1 id="super-admin-heading" className="app-page-title mt-2">
                  Command Center
                </h1>
                <p className="panel-kicker mt-1 text-sm">
                  Monitor AML risk signals, enforce compliance penalties, govern pools, and audit ledger activity.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleRunAmlScan}
                disabled={Boolean(overlayState)}
                className="app-panel-primary h-11 gap-2 rounded-xl font-bold shadow-sm"
              >
                <ScanSearch className="h-4 w-4" />
                Run AML Scan
              </Button>
              <Button
                variant="ghost"
                onClick={() => setManualFlagState({ open: true, user: null })}
                className="app-panel-secondary h-11 gap-1.5 rounded-xl font-semibold"
              >
                <Flag className="h-4 w-4" />
                Manual Flag
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPenaltyDialogState({ open: true, user: null, amlAlertId: null })}
                className="app-panel-secondary h-11 gap-1.5 rounded-xl font-semibold"
              >
                <Gavel className="h-4 w-4" />
                Issue Penalty
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadPlatformData}
                disabled={loadingPlatformData}
                className="app-panel-secondary h-11 w-11 rounded-xl"
                aria-label="Refresh platform data"
              >
                <RefreshCw className={cn("h-4 w-4", loadingPlatformData && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* 4 Executive Fintech KPI Tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-[#c2e4d4]">
                <span>Platform Users</span>
                <Users className="h-4 w-4 text-[#dbf5b4]" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                {users.length.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[#bfe3d2]">
                {bvnVerifiedCount} BVN verified · {restrictedUsersCount} restricted
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-[#c2e4d4]">
                <span>Group Liquidity</span>
                <Layers className="h-4 w-4 text-[#dbf5b4]" />
              </div>
              <p className="mt-1.5 truncate text-2xl font-extrabold tabular-nums text-[#dbf5b4] sm:text-3xl">
                {formatNaira(totalGroupLiquidity)}
              </p>
              <p className="mt-1 text-[11px] text-[#bfe3d2]">
                {allGroups.length} pools · {pendingWithdrawalsCount} pending votes
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-[#c2e4d4]">
                <span>Wallet Float</span>
                <Wallet className="h-4 w-4 text-[#dbf5b4]" />
              </div>
              <p className="mt-1.5 truncate text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                {formatNaira(totalWalletFloat)}
              </p>
              <p className="mt-1 text-[11px] text-[#bfe3d2]">
                {allTransactions.length.toLocaleString()} ledger entries
              </p>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-4 backdrop-blur-sm",
                activeAmlAlerts.length > 0
                  ? "border-amber-300/45 bg-amber-400/15"
                  : "border-white/15 bg-white/[0.08]"
              )}
            >
              <div className="flex items-center justify-between text-xs text-[#f6efd4]">
                <span>AML &amp; Compliance</span>
                <ShieldAlert className="h-4 w-4 text-amber-200" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                {activeAmlAlerts.length}
                <span className="ml-1.5 text-xs font-semibold text-amber-200">
                  active alert{activeAmlAlerts.length === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-[#f0e5c4]">
                {criticalAmlCount} high/critical · {formatNaira(activePenaltiesSum)} active fines
              </p>
            </div>
          </div>
        </section>

        {/* Overlapping Operations Body */}
        <div className="app-panel-body space-y-6">
          {/* Bold Mechanical Split-Flap Live User Counter Showcase */}
          <FlipCounterHero
            userCount={users.length}
            bvnVerifiedCount={bvnVerifiedCount}
            groupCount={allGroups.length}
            totalLiquidity={totalGroupLiquidity}
            externalPaymentsCount={externalPayments.length}
          />

          {loadingPlatformData && users.length === 0 ? (
            <BrandLoader
              variant="page"
              message="Loading Command Center"
              submessage="Syncing platform wallets, pools, AML engine, and audit logs…"
            />
          ) : (
            <Tabs defaultValue="aml" className="w-full space-y-6">
              <div className="overflow-x-auto pb-1">
                <TabsList className="app-segmented inline-flex h-auto w-max min-w-full justify-start gap-1 bg-muted/60 p-1 lg:grid lg:w-full lg:grid-cols-6">
                  <TabsTrigger value="aml" className="gap-1.5 px-3">
                    <ShieldAlert className="h-4 w-4" />
                    <span>AML Alerts</span>
                    {activeAmlAlerts.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-destructive px-1.5 py-0.2 text-[10px] font-bold text-destructive-foreground tabular-nums">
                        {activeAmlAlerts.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="external" className="gap-1.5 px-3">
                    <Globe2 className="h-4 w-4" />
                    <span>Outside Pay</span>
                    {unverifiedExternalCount > 0 && (
                      <span className="ml-0.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                        {unverifiedExternalCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="users" className="gap-1.5 px-3">
                    <Users className="h-4 w-4" />
                    <span>Users</span>
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="gap-1.5 px-3">
                    <Layers className="h-4 w-4" />
                    <span>Groups</span>
                  </TabsTrigger>
                  <TabsTrigger value="penalties" className="gap-1.5 px-3">
                    <Gavel className="h-4 w-4" />
                    <span>Penalties</span>
                    {penalties.filter((p) => p.status !== "waived").length > 0 && (
                      <span className="ml-0.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                        {penalties.filter((p) => p.status !== "waived").length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="ledger" className="gap-1.5 px-3">
                    <Activity className="h-4 w-4" />
                    <span>Ledger</span>
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="gap-1.5 px-3">
                    <ClipboardList className="h-4 w-4" />
                    <span>Audit Log</span>
                  </TabsTrigger>
                  <TabsTrigger value="gateway" className="gap-1.5 px-3">
                    <KeyRound className="h-4 w-4" />
                    <span>Settings</span>
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="gap-1.5 px-3">
                    <BarChart3 className="h-4 w-4" />
                    <span>Pricing &amp; revenue</span>
                  </TabsTrigger>
                  <TabsTrigger value="volume" className="gap-1.5 px-3">
                    <Activity className="h-4 w-4" />
                    <span>Transaction analytics</span>
                  </TabsTrigger>
                  <TabsTrigger value="ice-vault" className="gap-1.5 px-3">
                    <Snowflake className="h-4 w-4" />
                    <span>Ice Vault</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ================================================================
                  TAB 1: AML & FRAUD MONITORING
                 ================================================================ */}
              <TabsContent value="aml" className="space-y-5">
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
                    <Button size="sm" onClick={handleRunAmlScan} className="h-9 gap-1.5 rounded-xl">
                      <ScanSearch className="h-3.5 w-3.5" />
                      Scan Now
                    </Button>
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
                {filteredAlerts.length === 0 ? (
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
                    {filteredAlerts.map((alert) => (
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
                          {alert.user_id && alert.user_profile?.status !== "frozen" && (
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
                              onClick={() => {
                                const foundUser = users.find((u) => u.id === alert.user_id) || {
                                  id: alert.user_id,
                                  name: alert.user_profile?.name,
                                  email: alert.user_profile?.email,
                                  wallet_balance: 0,
                                };
                                setPenaltyDialogState({
                                  open: true,
                                  user: foundUser,
                                  amlAlertId: alert.id,
                                });
                              }}
                              className="h-9 gap-1 rounded-xl"
                            >
                              <Gavel className="h-3.5 w-3.5" />
                              Penalty
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ================================================================
                  TAB 1B: OUTSIDE / EXTERNAL PAYMENT TRACKING & AML SCREENING
                 ================================================================ */}
              <TabsContent value="external" className="space-y-4">
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

                {filteredExternalPayments.length === 0 ? (
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
                    {filteredExternalPayments.map((ep) => (
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
              </TabsContent>

              {/* ================================================================
                  TAB 2: USER & KYC MANAGEMENT
                 ================================================================ */}
              <TabsContent value="users" className="space-y-4">
                <div className="cp-card-native p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, or phone…"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "all", label: `All (${users.length})` },
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
                  {filteredUsers.map((u) => {
                    const prefs = (u.preferences || {}) as Record<string, any>;
                    const hasPin = hasTransactionPin(prefs);
                    const hasBvn = Boolean(u.bvn && String(u.bvn).trim().length >= 11);
                    const status = u.status || "active";
                    const isRestricted = status !== "active";

                    return (
                      <div
                        key={u.id}
                        className="cp-card-native flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <Avatar className="h-11 w-11 shrink-0 border">
                            <AvatarImage src={prefs.profileImage || ""} />
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
                              {(u as any).is_verified_organizer && (
                                <VerifiedCrowdfunderBadge
                                  label={(u as any).organizer_badge_label || "Verified Crowdfunder"}
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
                            <Button
                              size="sm"
                              variant={(u as any).is_verified_organizer ? "secondary" : "outline"}
                              onClick={() => setVerifyOrganizerTarget(u)}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                              {(u as any).is_verified_organizer ? "Verified" : "Verify Badge"}
                            </Button>
                            {hasBvn && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRemoveBvnTarget(u)}
                                className="h-9 gap-1 rounded-xl border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Unlink BVN
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setWalletDialogUser(u)}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Credit / Debit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPenaltyDialogState({ open: true, user: u, amlAlertId: null })
                              }
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Gavel className="h-3.5 w-3.5" />
                              Penalty
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setManualFlagState({ open: true, user: u })}
                              className="h-9 gap-1 rounded-xl text-xs"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              AML
                            </Button>
                            {isRestricted ? (
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
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <div className="cp-card-native py-12 text-center text-sm text-muted-foreground">
                      No users match your filter criteria.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ================================================================
                  TAB 3: GROUPS GOVERNANCE & OPERATIONS
                 ================================================================ */}
              <TabsContent value="groups" className="space-y-5">
                {/* Pending Withdrawals Oversight Banner */}
                {pendingWithdrawalsCount > 0 && (
                  <div className="cp-card-native border-amber-500/30 bg-amber-500/[0.06] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Vote className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {pendingWithdrawalsCount} Active Group Withdrawal Vote
                            {pendingWithdrawalsCount === 1 ? "" : "s"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pending governance disbursements across platform pools.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {withdrawals
                        .filter((w) => w.status === "pending")
                        .slice(0, 6)
                        .map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground">
                                {w.contribution_groups?.name || "Group Pool"}
                              </p>
                              <p className="truncate text-muted-foreground">{w.purpose}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-extrabold text-primary tabular-nums">
                                {formatNaira(w.amount)}
                              </p>
                              {w.contribution_id && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/groups/${w.contribution_id}`)}
                                  className="text-[11px] font-semibold text-primary hover:underline"
                                >
                                  Inspect →
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="cp-card-native p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search pools by name, category, or creator…"
                        value={groupQuery}
                        onChange={(e) => setGroupQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "all", label: `All (${allGroups.length})` },
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
                  {filteredGroups.map((group) => {
                    const current = Number(group.current_amount || 0);
                    const target = Math.max(1, Number(group.target_amount || 1));
                    const pct = Math.min(100, Math.round((current / target) * 100));
                    const memberCount = Array.isArray(group.contributors)
                      ? group.contributors.length
                      : 0;
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

                  {filteredGroups.length === 0 && (
                    <div className="cp-card-native col-span-full py-12 text-center text-sm text-muted-foreground">
                      No contribution groups match your search.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ================================================================
                  TAB 4: PENALTIES LEDGER
                 ================================================================ */}
              <TabsContent value="penalties" className="space-y-4">
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
                        {st}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setPenaltyDialogState({ open: true, user: null, amlAlertId: null })}
                    className="h-9 gap-1.5 rounded-xl"
                  >
                    <Gavel className="h-4 w-4" />
                    Issue Penalty
                  </Button>
                </div>

                {filteredPenalties.length === 0 ? (
                  <div className="cp-card-native py-14 text-center">
                    <Gavel className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      No penalties recorded
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issue late-contribution, dispute, or compliance fines from here or any user row.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPenalties.map((p) => (
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
                              {p.status}
                            </Badge>
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-foreground">
                              {p.penalty_type.replace(/_/g, " ")}
                            </span>
                            {p.deducted_from_wallet && (
                              <span className="text-[11px] font-semibold text-primary">
                                Deducted from wallet
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
                            Issued {safeFormatDate(p.created_at)}
                            {p.waived_at ? ` · Waived ${safeFormatDate(p.waived_at)}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:flex-col sm:items-end">
                          <span className="text-lg font-extrabold text-destructive tabular-nums">
                            {formatNaira(p.amount)}
                          </span>
                          {p.status !== "waived" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionPending}
                              onClick={() => handleWaivePenalty(p)}
                              className="h-9 rounded-xl text-xs"
                            >
                              {p.deducted_from_wallet ? "Waive & Refund" : "Waive Fine"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ================================================================
                  TAB 5: PLATFORM LEDGER & RECEIPTS
                 ================================================================ */}
              <TabsContent value="ledger" className="space-y-4">
                <div className="cp-card-native space-y-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by reference, user, pool, or description…"
                        value={txQuery}
                        onChange={(e) => setTxQuery(e.target.value)}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
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
                  {filteredTransactions.slice(0, 60).map((tx) => {
                    const isCredit = tx.type === "deposit" || tx.type === "refund";
                    const isHighValue = Number(tx.amount || 0) >= HIGH_VALUE_THRESHOLD;

                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => openTransactionReceipt(tx)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/45"
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
                            {isCredit ? (
                              <ArrowDownLeft className="h-4.5 w-4.5" />
                            ) : (
                              <ArrowUpRight className="h-4.5 w-4.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-bold capitalize text-foreground">
                                {tx.metadata?.category === "admin_penalty"
                                  ? "Compliance Penalty"
                                  : tx.type}
                              </span>
                              {isHighValue && (
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                                  AML Threshold
                                </span>
                              )}
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                {tx.status || "completed"}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {tx.profiles?.name || tx.profiles?.email || "User"} ·{" "}
                              {tx.description || tx.contribution_groups?.name || tx.reference_id}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-sm font-extrabold tabular-nums",
                              isCredit ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                            )}
                          >
                            {isCredit ? "+" : "-"}
                            {formatNaira(tx.amount)}
                          </p>
                          <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                            <ReceiptText className="h-3 w-3" />
                            {safeFormatDate(tx.created_at, "MMM d, h:mm a")}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {filteredTransactions.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No transactions match your current filters.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ================================================================
                  TAB 6: COMPLIANCE AUDIT TRAIL
                 ================================================================ */}
              <TabsContent value="audit" className="space-y-4">
                <div className="cp-card-native p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter audit log by action, admin, or summary…"
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>
                </div>

                <div className="cp-card-native divide-y divide-border/70 overflow-hidden">
                  {filteredAuditLogs.map((log) => (
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

                  {filteredAuditLogs.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No audit entries yet. Actions taken in this console are logged automatically.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ================================================================
                  TAB 7: FLUTTERWAVE GATEWAY & WEBHOOK SETTINGS
                 ================================================================ */}
              <TabsContent value="gateway" className="space-y-4">
                <AdminPaymentAlertSounds />
                <AdminPaymentSettings onSettingsSaved={() => void loadPlatformData()} />
              </TabsContent>
              <TabsContent value="pricing" className="space-y-4">
                <AdminPricingRevenue />
                <AdminWalletBankBonus />
              </TabsContent>
              <TabsContent value="volume"><AdminTransactionAnalytics /></TabsContent>
              <TabsContent value="ice-vault"><AdminIceVault /></TabsContent>
            </Tabs>
          )}
        </div>
      </main>

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
        users={users}
        groups={allGroups}
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

      <RemoveBvnDialog
        open={Boolean(removeBvnTarget)}
        onOpenChange={(open) => !open && setRemoveBvnTarget(null)}
        user={removeBvnTarget}
        pending={actionPending}
        onConfirm={handleRemoveUserBvn}
      />

      <AmlReviewDialog
        open={Boolean(reviewingAlert)}
        onOpenChange={(open) => !open && setReviewingAlert(null)}
        alert={reviewingAlert}
        pending={actionPending}
        onUpdateStatus={handleUpdateAmlAlert}
        onFreezeUser={async (uid, reason) => {
          await handleUpdateUserStatus(uid, "frozen", reason);
          setReviewingAlert(null);
        }}
        onOpenPenaltyForAlert={(alert) => {
          const foundUser = users.find((u) => u.id === alert.user_id) || {
            id: alert.user_id,
            name: alert.user_profile?.name,
            email: alert.user_profile?.email,
            wallet_balance: 0,
          };
          setPenaltyDialogState({ open: true, user: foundUser, amlAlertId: alert.id });
        }}
      />

      <ManualAmlFlagDialog
        open={manualFlagState.open}
        onOpenChange={(open) => !open && setManualFlagState({ open: false, user: null })}
        users={users}
        presetUser={manualFlagState.user}
        pending={actionPending}
        onConfirm={handleCreateManualFlag}
      />

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
