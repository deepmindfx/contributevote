import { supabase } from "@/integrations/supabase/client";

export type PlatformPricing = {
  daily_free_transfers: number;
  friday_free: boolean;
  group_withdrawal_percent: number;
  bank_transfer_fees_enabled: boolean;
  bank_transfer_small_fee: number;
  bank_transfer_large_fee: number;
  bank_transfer_threshold: number;
  group_withdrawal_fees_enabled: boolean;
  updated_at: string;
};

export type TransferAllowance = {
  daily_limit: number;
  daily_remaining: number;
  friday_free: boolean;
  free_today: boolean;
  small_fee: number;
  large_fee: number;
  threshold: number;
  fees_enabled?: boolean;
};

export type PricingReport = {
  pricing: PlatformPricing;
  revenue: { bank_transfer: number; group_withdrawal: number; last_30_days: number; total: number };
};

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol",
});

export function pricedTransferFee(amount: number, policy: TransferAllowance) {
  return policy.fees_enabled === false || policy.free_today || policy.daily_remaining > 0 ? 0 : amount > policy.threshold ? policy.large_fee : policy.small_fee;
}

export function withdrawalFee(amount: number, rate: number) {
  const cents = Math.round(amount * 100);
  return Math.max(0, Math.min(cents - 1, Math.round((cents * Math.round(rate * 100)) / 10_000))) / 100;
}

export async function getTransferAllowance(): Promise<TransferAllowance> {
  const { data, error } = await supabase.rpc("get_wallet_transfer_allowance");
  if (error || !data) throw new Error(error?.message || "Transfer pricing is unavailable.");
  return data as TransferAllowance;
}

export async function getPlatformPricing(): Promise<PlatformPricing> {
  const { data, error } = await supabase.rpc("get_platform_pricing");
  if (error || !data) throw new Error(error?.message || "Pricing is unavailable.");
  return data as PlatformPricing;
}

export async function getPricingReport(): Promise<PricingReport> {
  const { data, error } = await supabase.rpc("admin_platform_pricing_report");
  if (error || !data) throw new Error(error?.message || "Pricing report is unavailable.");
  return data as PricingReport;
}

export async function savePlatformPricing(settings: Omit<PlatformPricing, "updated_at">) {
  const { error } = await supabase.rpc("admin_save_transfer_pricing", { p_settings: settings });
  if (error) throw new Error(error.message);
}

export async function getGroupWithdrawalPolicy(groupId: string) {
  const { data, error } = await supabase.rpc("get_group_withdrawal_policy", { p_group_id: groupId });
  if (error || !data) throw new Error(error?.message || "Group pricing is unavailable.");
  return data as { percent: number; override: boolean | null };
}

export async function setGroupWithdrawalOverride(groupId: string, enabled: boolean | null) {
  const { error } = await supabase.rpc("admin_set_group_withdrawal_fee", { p_group_id: groupId, p_enabled: enabled });
  if (error) throw new Error(error.message);
}
