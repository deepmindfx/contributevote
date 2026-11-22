import { supabase } from "@/integrations/supabase/client";

export type PlatformPricing = {
  daily_free_transfers: number;
  friday_free: boolean;
  group_withdrawal_percent: number;
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
};

export type PricingReport = {
  pricing: PlatformPricing;
  revenue: { bank_transfer: number; group_withdrawal: number; last_30_days: number; total: number };
};

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol",
});

export function pricedTransferFee(amount: number, policy: TransferAllowance) {
  return policy.free_today || policy.daily_remaining > 0 ? 0 : amount > policy.threshold ? policy.large_fee : policy.small_fee;
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

export async function savePlatformPricing(dailyFree: number, fridayFree: boolean, withdrawalPercent: number) {
  const { error } = await supabase.rpc("admin_update_platform_pricing", {
    p_daily_free: dailyFree, p_friday_free: fridayFree, p_withdrawal_percent: withdrawalPercent,
  });
  if (error) throw new Error(error.message);
}
