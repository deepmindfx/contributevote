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
  user_profile?: { name: string | null; email: string | null; status: string | null; has_bvn: boolean } | null;
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

export interface PaymentGatewaySettings {
  provider: string;
  flutterwave_mode: "live" | "test";
  flutterwave_public_key: string;
  webhook_url: string;
  has_secret_key: boolean;
  secret_key_masked: string | null;
  has_encryption_key: boolean;
  encryption_key_masked: string | null;
  has_webhook_hash: boolean;
  webhook_hash_masked: string | null;
  static_ip_proxy_url: string;
  static_ip_address: string;
  has_proxy_secret: boolean;
  proxy_secret_masked: string | null;
  transfers_enabled: boolean;
  updated_at: string | null;
}

export const SPOTLIGHT_LABEL_PRESETS = [
  "Most Needed",
  "Urgent Cause",
  "Verified Cause",
  "Featured",
  "Community Pick",
  "High Impact",
] as const;

export const ORGANIZER_BADGE_PRESETS = [
  "Verified Crowdfunder",
  "Verified Mosque / Waqf",
  "Verified Church",
  "Verified NGO / Charity",
  "Verified Innovator",
  "Verified Community",
] as const;

export const PENALTY_TYPE_OPTIONS: { value: PenaltyType; label: string }[] = [
  { value: "late_contribution", label: "Missed contribution" },
  { value: "policy_violation", label: "Policy issue" },
  { value: "aml_hold", label: "AML review" },
  { value: "fraud_chargeback", label: "Fraud or chargeback" },
  { value: "dispute_fine", label: "Dispute outcome" },
];

export const AdminComplianceService = {
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
      p_deduct_wallet: false,
      p_group_id: payload.groupId || null,
      p_aml_alert_id: payload.amlAlertId || null,
    });
    if (error) throw error;
    return data;
  },

  async waivePenalty(
    penaltyId: string,
    note?: string
  ): Promise<{ success: boolean; refunded?: boolean; error?: string }> {
    const { data, error } = await (supabase as any).rpc("admin_waive_penalty", {
      p_penalty_id: penaltyId,
      p_refund_wallet: false,
      p_note: note || "Closed by administrator",
    });
    if (error) throw error;
    return data;
  },

  async requestWalletAdjustment(payload: {
    userId: string;
    amount: number;
    reason: string;
    caseReference: string;
    pin: string;
  }): Promise<{ success: boolean; status?: string; error?: string }> {
    const { data, error } = await supabase.rpc("admin_request_wallet_adjustment", {
      p_user_id: payload.userId,
      p_amount: payload.amount,
      p_direction: "debit",
      p_reason: payload.reason,
      p_case_reference: payload.caseReference,
      p_pin: payload.pin,
    });
    if (error) throw error;
    return data as { success: boolean; status?: string; error?: string };
  },

  async decideWalletAdjustment(requestId: string, approve: boolean, pin: string): Promise<{ success: boolean; status?: string; error?: string }> {
    const { data, error } = await supabase.rpc("admin_decide_wallet_adjustment", {
      p_request_id: requestId, p_approve: approve, p_pin: pin,
    });
    if (error) throw error;
    return data as { success: boolean; status?: string; error?: string };
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

  async updateGroupSpotlight(payload: {
    groupId: string;
    isVerified: boolean;
    isPinned: boolean;
    spotlightLabel?: string | null;
    featuredPriority?: number;
    note?: string;
  }): Promise<{
    success: boolean;
    is_verified?: boolean;
    is_pinned?: boolean;
    spotlight_label?: string | null;
    featured_priority?: number;
    error?: string;
  }> {
    const { data, error } = await (supabase as any).rpc("admin_update_group_spotlight", {
      p_group_id: payload.groupId,
      p_is_verified: payload.isVerified,
      p_is_pinned: payload.isPinned,
      p_spotlight_label: payload.spotlightLabel ?? "",
      p_featured_priority: payload.featuredPriority ?? (payload.isPinned ? 50 : 0),
      p_note: payload.note || null,
    });
    if (error) throw error;
    return data;
  },

  async toggleVerifiedOrganizer(payload: {
    userId: string;
    isVerified: boolean;
    badgeLabel?: string;
    applyToGroups?: boolean;
  }): Promise<{
    success: boolean;
    is_verified_organizer?: boolean;
    badge_label?: string | null;
    groups_updated?: number;
    error?: string;
  }> {
    const { data, error } = await (supabase as any).rpc("admin_toggle_verified_organizer", {
      p_user_id: payload.userId,
      p_is_verified: payload.isVerified,
      p_badge_label: payload.badgeLabel || "Verified Crowdfunder",
      p_apply_to_groups: payload.applyToGroups !== false,
    });
    if (error) throw error;
    return data;
  },

  async getPaymentSettings(): Promise<{
    success: boolean;
    data?: PaymentGatewaySettings;
    error?: string;
  }> {
    const { data, error } = await (supabase as any).rpc("admin_get_payment_settings");
    if (error) throw error;
    return data;
  },

  async savePaymentSettings(payload: {
    mode: "live" | "test";
    publicKey?: string;
    secretKey?: string;
    encryptionKey?: string;
    webhookHash?: string;
    webhookUrl?: string;
    staticIpProxyUrl?: string;
    staticIpProxySecret?: string;
    staticIpAddress?: string;
    transfersEnabled?: boolean;
  }): Promise<{
    success: boolean;
    data?: PaymentGatewaySettings;
    error?: string;
  }> {
    const { data, error } = await (supabase as any).rpc("admin_save_payment_settings", {
      p_mode: payload.mode,
      p_public_key: payload.publicKey ?? null,
      p_secret_key: payload.secretKey?.trim() ? payload.secretKey.trim() : null,
      p_encryption_key: payload.encryptionKey?.trim() ? payload.encryptionKey.trim() : null,
      p_webhook_hash: payload.webhookHash?.trim() ? payload.webhookHash.trim() : null,
      p_webhook_url: payload.webhookUrl?.trim() ? payload.webhookUrl.trim() : null,
      p_static_ip_proxy_url: payload.staticIpProxyUrl ?? null,
      p_static_ip_proxy_secret: payload.staticIpProxySecret?.trim()
        ? payload.staticIpProxySecret.trim()
        : null,
      p_static_ip_address: payload.staticIpAddress?.trim() || null,
      p_transfers_enabled:
        typeof payload.transfersEnabled === "boolean" ? payload.transfersEnabled : null,
    });
    if (error) throw error;
    return data;
  },

  async testStaticIpRelay(): Promise<{
    success: boolean;
    staticIp?: string;
    url?: string;
    uptimeSec?: number | null;
    latencyMs: number;
    error?: string;
  }> {
    const started = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("flutterwave-banks", {
        body: { fresh: true, checkRelayOnly: true },
      });
      const latencyMs = Math.round(performance.now() - started);
      if (error) {
        return { success: false, latencyMs, error: error.message || "Relay probe failed" };
      }
      if (!data?.success) {
        return { success: false, latencyMs, error: data?.error || "Static-IP Relay unreachable" };
      }
      return {
        success: true,
        staticIp: data.relay?.staticIp,
        url: data.relay?.url,
        uptimeSec: data.relay?.uptimeSec,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - started),
        error: err?.message || "Static-IP Relay probe failed",
      };
    }
  },

  async testFlutterwaveConnection(): Promise<{
    success: boolean;
    bankCount?: number;
    mode?: string;
    source?: string;
    routedViaStaticIp?: boolean;
    staticIpAddress?: string | null;
    latencyMs: number;
    error?: string;
  }> {
    const started = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("flutterwave-banks", {
        body: { fresh: true },
      });
      const latencyMs = Math.round(performance.now() - started);
      if (error) {
        return { success: false, latencyMs, error: error.message || "Edge function request failed" };
      }
      if (!data?.success) {
        return { success: false, latencyMs, error: data?.error || "Flutterwave API rejected credentials" };
      }
      return {
        success: true,
        bankCount: Array.isArray(data.data) ? data.data.length : data.meta?.count || 0,
        mode: data.meta?.mode,
        source: data.meta?.source,
        routedViaStaticIp: Boolean(data.meta?.routedViaStaticIp),
        staticIpAddress: data.meta?.staticIpAddress || null,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - started),
        error: err?.message || "Connection test failed",
      };
    }
  },
};
