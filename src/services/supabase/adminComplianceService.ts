import { supabase } from "@/integrations/supabase/client";

export type AmlAlertSeverity = "low" | "medium" | "high" | "critical";
export type AmlAlertStatus = "open" | "investigating" | "escalated" | "resolved" | "dismissed";
export type PenaltyType =
  | "late_contribution"
  | "policy_violation"
  | "aml_hold"
  | "fraud_chargeback"
  | "dispute_fine";

export interface AmlAlertRecord {
  id: string;
  alert_key: string | null;
  user_id: string | null;
  group_id: string | null;
  transaction_id: string | null;
  alert_type: string;
  severity: AmlAlertSeverity;
  status: AmlAlertStatus;
  risk_score: number;
  amount: number | null;
  title: string;
  description: string;
  evidence: Record<string, any>;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: { name: string | null; email: string | null; status: string | null; bvn: string | null } | null;
  group?: { name: string | null; status: string | null } | null;
}

export interface AdminPenaltyRecord {
  id: string;
  user_id: string;
  group_id: string | null;
  aml_alert_id: string | null;
  penalty_type: PenaltyType;
  amount: number;
  reason: string;
  status: "applied" | "waived" | "pending";
  deducted_from_wallet: boolean;
  transaction_id: string | null;
  issued_by: string | null;
  waived_by: string | null;
  waived_at: string | null;
  waive_note: string | null;
  created_at: string;
  user_profile?: { name: string | null; email: string | null } | null;
  group?: { name: string | null } | null;
}

export interface AdminAuditLogRecord {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: "user" | "group" | "aml_alert" | "penalty" | "transaction" | "system";
  target_id: string | null;
  summary: string;
  metadata: Record<string, any>;
  created_at: string;
  admin_profile?: { name: string | null; email: string | null } | null;
}

export interface AdminWithdrawalRecord {
  id: string;
  contribution_id: string | null;
  requester_id: string | null;
  amount: number;
  purpose: string;
  status: string;
  deadline: string;
  votes: any;
  created_at: string | null;
  contribution_groups?: { name: string | null } | null;
  profiles?: { name: string | null; email: string | null } | null;
}

export interface ExternalPaymentTrackRecord {
  id: string;
  reference_id: string | null;
  source_channel:
    | "group_bank_transfer"
    | "wallet_bank_transfer"
    | "card_checkout"
    | "share_link"
    | "manual_claim";
  group_id: string | null;
  user_id: string | null;
  transaction_id: string | null;
  amount: number;
  currency: string;
  sender_name: string | null;
  sender_bank: string | null;
  sender_account_masked: string | null;
  sender_email: string | null;
  destination_account: string | null;
  narration: string | null;
  verification_status: "unverified" | "verified" | "flagged" | "blocked";
  aml_risk_level: AmlAlertSeverity;
  aml_flags: string[];
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_profile?: { name: string | null; email: string | null } | null;
  group?: { name: string | null } | null;
}

export const PENALTY_TYPE_OPTIONS: { value: PenaltyType; label: string; description: string }[] = [
  {
    value: "late_contribution",
    label: "Late Contribution Fee",
    description: "Missed scheduled contribution deadline in a pool",
  },
  {
    value: "policy_violation",
    label: "Policy Violation",
    description: "Breach of CollectiPay platform or group governance terms",
  },
  {
    value: "aml_hold",
    label: "AML / Compliance Fine",
    description: "Regulatory or anti-money laundering compliance breach",
  },
  {
    value: "fraud_chargeback",
    label: "Fraud / Chargeback Recovery",
    description: "Recovery for disputed, reversed, or fraudulent activity",
  },
  {
    value: "dispute_fine",
    label: "Dispute Settlement Fine",
    description: "Administrative penalty from a resolved member dispute",
  },
];

export const AdminComplianceService = {
  async getAmlAlerts(): Promise<AmlAlertRecord[]> {
    const { data, error } = await (supabase as any)
      .from("aml_alerts")
      .select(`
        *,
        user_profile:profiles!aml_alerts_user_id_fkey(name, email, status, bvn),
        group:contribution_groups!aml_alerts_group_id_fkey(name, status)
      `)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) throw error;
    return (data || []) as AmlAlertRecord[];
  },

  async getPenalties(): Promise<AdminPenaltyRecord[]> {
    const { data, error } = await (supabase as any)
      .from("admin_penalties")
      .select(`
        *,
        user_profile:profiles!admin_penalties_user_id_fkey(name, email),
        group:contribution_groups!admin_penalties_group_id_fkey(name)
      `)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) throw error;
    return (data || []) as AdminPenaltyRecord[];
  },

  async getAuditLogs(): Promise<AdminAuditLogRecord[]> {
    const { data, error } = await (supabase as any)
      .from("admin_audit_logs")
      .select(`
        *,
        admin_profile:profiles!admin_audit_logs_admin_id_fkey(name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data || []) as AdminAuditLogRecord[];
  },

  async getPendingWithdrawals(): Promise<AdminWithdrawalRecord[]> {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select(`
        *,
        contribution_groups(name),
        profiles!withdrawal_requests_requester_id_fkey(name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data || []) as AdminWithdrawalRecord[];
  },

  async getExternalPayments(): Promise<ExternalPaymentTrackRecord[]> {
    const { data, error } = await (supabase as any)
      .from("external_payment_tracks")
      .select(`
        *,
        user_profile:profiles!external_payment_tracks_user_id_fkey(name, email),
        group:contribution_groups!external_payment_tracks_group_id_fkey(name)
      `)
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) throw error;
    return (data || []) as ExternalPaymentTrackRecord[];
  },

  async reviewExternalPayment(
    trackId: string,
    status: "unverified" | "verified" | "flagged" | "blocked",
    note?: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_review_external_payment", {
      p_track_id: trackId,
      p_status: status,
      p_note: note || null,
    });
    if (error) throw error;
    return data;
  },

  async runAmlScan(): Promise<{ success: boolean; new_alerts?: number; active_alerts?: number; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_scan_aml_alerts");
    if (error) throw error;
    return data;
  },

  async updateAmlAlert(
    alertId: string,
    status: AmlAlertStatus,
    resolutionNote?: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_update_aml_alert", {
      p_alert_id: alertId,
      p_status: status,
      p_resolution_note: resolutionNote || null,
    });
    if (error) throw error;
    return data;
  },

  async createManualAmlAlert(payload: {
    userId: string;
    title: string;
    description: string;
    severity: AmlAlertSeverity;
    riskScore: number;
    amount?: number;
    groupId?: string | null;
  }): Promise<{ success: boolean; alert_id?: string; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_create_aml_alert", {
      p_user_id: payload.userId,
      p_title: payload.title,
      p_description: payload.description,
      p_severity: payload.severity,
      p_risk_score: payload.riskScore,
      p_amount: payload.amount ?? 0,
      p_group_id: payload.groupId || null,
    });
    if (error) throw error;
    return data;
  },

  async issuePenalty(payload: {
    userId: string;
    amount: number;
    penaltyType: PenaltyType;
    reason: string;
    deductWallet: boolean;
    groupId?: string | null;
    amlAlertId?: string | null;
  }): Promise<{
    success: boolean;
    penalty_id?: string;
    status?: string;
    deducted_from_wallet?: boolean;
    error?: string;
  }> {
    const { data, error } = await (supabase as any).rpc("admin_issue_penalty", {
      p_user_id: payload.userId,
      p_amount: payload.amount,
      p_penalty_type: payload.penaltyType,
      p_reason: payload.reason,
      p_deduct_wallet: payload.deductWallet,
      p_group_id: payload.groupId || null,
      p_aml_alert_id: payload.amlAlertId || null,
    });
    if (error) throw error;
    return data;
  },

  async waivePenalty(
    penaltyId: string,
    refundWallet = true,
    note?: string
  ): Promise<{ success: boolean; refunded?: boolean; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_waive_penalty", {
      p_penalty_id: penaltyId,
      p_refund_wallet: refundWallet,
      p_note: note || "Waived by administrator",
    });
    if (error) throw error;
    return data;
  },

  async adjustUserWallet(payload: {
    userId: string;
    amount: number;
    direction: "credit" | "debit";
    reason: string;
  }): Promise<{ success: boolean; balance_after?: number; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_adjust_user_wallet", {
      p_target_user_id: payload.userId,
      p_amount: payload.amount,
      p_direction: payload.direction,
      p_reason: payload.reason,
    });
    if (error) throw error;
    return data;
  },

  async updateUserStatus(
    userId: string,
    status: "active" | "paused" | "frozen" | "suspended",
    reason?: string
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_update_user_status", {
      p_user_id: userId,
      p_status: status,
      p_reason: reason || null,
    });
    if (error) throw error;
    return data;
  },

  async updateGroupStatus(payload: {
    groupId: string;
    status?: "active" | "paused" | "frozen" | "completed" | "cancelled";
    archived?: boolean;
    reason?: string;
  }): Promise<{ success: boolean; status?: string; archived?: boolean; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_update_group_status", {
      p_group_id: payload.groupId,
      p_status: payload.status || null,
      p_archived: typeof payload.archived === "boolean" ? payload.archived : null,
      p_reason: payload.reason || null,
    });
    if (error) throw error;
    return data;
  },
};
