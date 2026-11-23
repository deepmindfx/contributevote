import { supabase } from "@/integrations/supabase/client";
import type { BulkRecipientInput } from "@/lib/bulkTransfers";

export type BulkTransferSettings = {
  enabled: boolean;
  max_recipients: number;
  max_batch_amount: number;
  daily_amount_limit: number;
  small_fee: number;
  medium_fee: number;
  large_fee: number;
  vat_percent: number;
};

export type BulkTransferBatch = {
  id: string;
  user_id: string;
  owner_name?: string;
  title: string;
  recipient_count: number;
  principal: number;
  fee: number;
  vat: number;
  vat_percent: number;
  total: number;
  settled_principal: number;
  settled_fee: number;
  settled_vat: number;
  refunded_total: number;
  completed: number;
  failed: number;
  pending: number;
  authorized_at: string | null;
  expires_at: string;
  provider_batch_id: string | null;
  status: "quoted" | "expired" | "completed" | "failed" | "partial" | "reserved" | "needs_review" | "processing";
  recipients?: Array<BulkRecipientInput & {
    row_number: number; beneficiary_name: string; fee: number; vat: number; reference: string;
    status: "quoted" | "pending" | "completed" | "failed"; message: string | null;
  }>;
};

export async function getBulkTransferSettings() {
  const { data, error } = await supabase.rpc("get_bulk_transfer_settings");
  if (error || !data) throw new Error("Couldn’t load bulk transfer settings.");
  return data as BulkTransferSettings;
}

export async function saveBulkTransferSettings(p_settings: BulkTransferSettings) {
  const { data, error } = await supabase.rpc("admin_update_bulk_transfer_settings", { p_settings });
  if (error || !data) throw new Error(error?.message ?? "Couldn’t save settings.");
  return data as BulkTransferSettings;
}

export async function getBulkTransferBatch(p_batch_id: string, p_admin = false) {
  const { data, error } = await supabase.rpc("get_bulk_transfer_batch", { p_batch_id, p_admin });
  if (error || !data) throw new Error("This bulk transfer could not be loaded.");
  return data as unknown as BulkTransferBatch;
}

export async function getBulkTransferHistory(p_admin = false, p_before?: string) {
  const { data, error } = await supabase.rpc("get_bulk_transfer_history", { p_admin, p_before });
  if (error) throw new Error("Couldn’t load bulk transfer history.");
  return (data ?? []) as unknown as BulkTransferBatch[];
}

export type BulkHistoryStatus = "pending" | "completed" | "partial" | "failed" | "needs_review";
export type BulkHistoryCursor = { before: string; id: string };
export type BulkTransferAnalytics = {
  totals: {
    batches: number; recipients: number; completed: number; failed: number; pending: number;
    authorized_total: number; paid_principal: number; paid_fee: number; paid_vat: number;
    refunded_total: number; pending_total: number; previous_paid_principal: number;
  };
  daily: Array<{ day: number; paid: number; pending: number; failed: number }>;
  banks: Array<{
    bank_code: string | null; bank_name: string | null; recipients: number; completed: number;
    pending: number; failed: number; paid_principal: number;
  }>;
};

export async function loadBulkTransferAnalytics(month: string, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("get_my_bulk_transfer_analytics", { p_month: `${month}-01` }).abortSignal(signal);
  if (error || !data) throw new Error("Couldn’t load bulk transfer analytics.");
  return data as BulkTransferAnalytics;
}

export async function loadBulkTransferHistory(month: string, status: BulkHistoryStatus | undefined, cursor: BulkHistoryCursor | null, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("get_my_bulk_transfer_history", {
    p_month: `${month}-01`, p_status: status, p_before: cursor?.before, p_before_id: cursor?.id,
  }).abortSignal(signal);
  if (error) throw new Error("Couldn’t load your batches.");
  return (data ?? []) as unknown as BulkTransferBatch[];
}

type BulkAction = { action: "quote"; title: string; recipients: BulkRecipientInput[] }
  | { action: "submit"; batch_id: string; transaction_pin?: string }
  | { action: "reconcile"; batch_id: string };

export async function runBulkTransfer(body: BulkAction) {
  const { data, error } = await supabase.functions.invoke("flutterwave-bulk-transfer", { body });
  if (error) {
    const parsed = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof parsed?.error === "string" ? parsed.error : "Couldn’t reach bulk transfers. Reopen the same batch to check its status.");
  }
  if (typeof data?.batch_id !== "string") throw new Error("Couldn’t confirm the batch.");
  return data.batch_id as string;
}
