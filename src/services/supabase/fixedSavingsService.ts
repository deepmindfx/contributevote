import { supabase } from "@/integrations/supabase/client";

export const savingsPeriods = [7, 14, 30, 60, 90] as const;
export type SavingsPeriod = (typeof savingsPeriods)[number];
export type SavingsStatus = "reserving" | "active" | "matured" | "withdrawn" | "failed";
export type SavingsSettlement = "wallet_ledger" | "partner_api";

export type SavingsItem = {
  id: string;
  amount: number;
  days: SavingsPeriod;
  status: SavingsStatus;
  settlement_mode: SavingsSettlement;
  custodian_name: string | null;
  requested_at: string;
  maturity_at: string;
  locked_at: string | null;
  matured_at: string | null;
  credited_at: string | null;
  withdrawn_at: string | null;
};

export type SavingsQuote = {
  id: string;
  amount: number;
  days: SavingsPeriod;
  maturity_at: string;
  expires_at: string;
  terms_version: string;
  terms_url: string;
  settlement_mode: SavingsSettlement;
  custodian_name: string | null;
};

export type SavingsCursor = { before: string; id: string };
type SavingsPage = {
  enabled: boolean;
  items: SavingsItem[];
  totals: { locked: number; pending: number; available: number; active_count: number };
  limits: { min_amount: number; max_amount: number; allowed_days: SavingsPeriod[] };
  server_now: string;
  received_at: number;
};

export async function getFixedSavings(cursor: SavingsCursor | null, signal: AbortSignal): Promise<SavingsPage> {
  const { data, error } = await supabase.rpc("get_my_fixed_savings", cursor ? {
    p_before: cursor.before, p_before_id: cursor.id,
  } : {}).abortSignal(signal);
  if (error || !data) throw new Error(error?.message || "Couldn’t load Ice Vault.");
  return { ...(data as Omit<SavingsPage, "received_at">), received_at: Date.now() };
}

export async function quoteSavings(amount: number, days: SavingsPeriod): Promise<SavingsQuote> {
  const { data, error } = await supabase.rpc("quote_fixed_savings", { p_amount: amount, p_days: days });
  const result = data as SavingsQuote & { error?: string };
  if (error || !result?.id) throw new Error(result?.error || error?.message || "Couldn’t prepare the lock.");
  return result;
}

export async function openSavings(quote: SavingsQuote, accepted: boolean, pin: string) {
  const { data, error } = await supabase.rpc("open_fixed_savings", {
    p_quote_id: quote.id, p_terms_version: quote.terms_version, p_accepted: accepted, p_pin: pin,
  });
  const result = data as { id?: string; status?: SavingsStatus; error?: string; message?: string };
  if (error || !result?.id || !result.status) throw new Error(result?.error || result?.message || error?.message || "Couldn’t confirm the lock.");
  return result.status;
}

export async function withdrawSavings(id: string) {
  const { data, error } = await supabase.rpc("withdraw_fixed_savings", { p_savings_id: id });
  const result = data as { id?: string; amount?: number; error?: string };
  if (error || !result?.id) throw new Error(result?.error || error?.message || "Couldn’t move the amount to your wallet.");
  return result.amount;
}

export type IceVaultSettings = {
  revision: number;
  enabled: boolean;
  ready: boolean;
  settlement_mode: SavingsSettlement;
  scheduler_seen_at: string | null;
  min_amount: number;
  max_amount: number;
  max_wallet_locked: number;
  max_active_locks: number;
  allowed_days: SavingsPeriod[];
  terms_version: string | null;
  terms_url: string | null;
};

export type IceVaultReport = {
  settings: IceVaultSettings;
  totals: { locked: number; active_count: number; pending: number; matured_uncredited: number; released_30d: number;
    due_next_7d: number; overdue_count: number; overdue_amount: number; old_pending_count: number };
  updated_at: string | null;
};

export async function getIceVaultReport(signal: AbortSignal) {
  const { data, error } = await supabase.rpc("admin_get_fixed_savings").abortSignal(signal);
  if (error || !data) throw new Error(error?.message || "Couldn’t load the Ice Vault report.");
  return data as IceVaultReport;
}

export async function saveIceVaultSettings(settings: Omit<IceVaultSettings, "ready" | "settlement_mode" | "scheduler_seen_at">) {
  const { error } = await supabase.rpc("admin_save_fixed_savings", {
    p_revision: settings.revision, p_enabled: settings.enabled, p_min_amount: settings.min_amount,
    p_max_amount: settings.max_amount, p_max_wallet_locked: settings.max_wallet_locked,
    p_max_active_locks: settings.max_active_locks, p_allowed_days: settings.allowed_days,
    p_terms_version: settings.terms_version ?? "", p_terms_url: settings.terms_url ?? "",
  });
  if (error) throw new Error(error.message);
}
